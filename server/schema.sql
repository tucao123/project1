-- RFR 关系数据模型（MySQL 8.0.19+ / InnoDB）
-- PRD §5.1：核心查询字段用独立列，半结构化字段用 JSON，过滤字段用生成列 + B-Tree 索引。
-- 禁止用 TEXT 存 JSON 冒充 JSON 类型。

CREATE TABLE IF NOT EXISTS users (
  user_id      VARCHAR(64)  NOT NULL,
  display_name VARCHAR(64)  NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 单独明示授权：默认 0，不与服务协议捆绑，可随时撤回（PRD §7.1）
CREATE TABLE IF NOT EXISTS consents (
  consent_id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      VARCHAR(64) NOT NULL,
  purpose      VARCHAR(64) NOT NULL DEFAULT 'feedback_for_role_card',
  granted      TINYINT(1)  NOT NULL DEFAULT 0,
  granted_at   DATETIME    NULL,
  revoked_at   DATETIME    NULL,
  PRIMARY KEY (consent_id),
  UNIQUE KEY uq_consent_user_purpose (user_id, purpose),
  CONSTRAINT fk_consent_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 原始自由文本只存哈希，不落明文；anon_at 记录 7 天内删除/匿名化动作
CREATE TABLE IF NOT EXISTS intakes (
  intake_id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id            VARCHAR(64) NOT NULL,
  session_id         VARCHAR(64) NOT NULL,
  intake_payload     JSON NOT NULL,
  friction_events    JSON NULL,
  stressor_type      VARCHAR(64)
    GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(intake_payload, '$.stressor_type'))) STORED,
  commitment_level   VARCHAR(16)
    GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(intake_payload, '$.commitment_level'))) STORED,
  free_text_hash     CHAR(64) NULL,
  free_text_purged_at DATETIME NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (intake_id),
  INDEX idx_intakes_user_session (user_id, session_id, created_at),
  INDEX idx_intakes_stressor (stressor_type),
  INDEX idx_intakes_commitment (commitment_level),
  CONSTRAINT fk_intake_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- MySQL 8.0.17+ 可选的多值索引（按需启用，骨架不强依赖）：
-- CREATE INDEX idx_intakes_friction_mv ON intakes ((CAST(friction_events AS CHAR(64) ARRAY)));

CREATE TABLE IF NOT EXISTS scenario_choices (
  choice_id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id        VARCHAR(64) NOT NULL,
  user_id           VARCHAR(64) NOT NULL,
  scenario_id       VARCHAR(64) NOT NULL,
  option_code       VARCHAR(16) NOT NULL,
  agency            TINYINT      NOT NULL DEFAULT 0,
  constructiveness  TINYINT      NOT NULL DEFAULT 0,
  answered_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (choice_id),
  INDEX idx_choices_session (session_id),
  INDEX idx_choices_user (user_id, answered_at),
  CONSTRAINT fk_choice_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS profiles (
  profile_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id      VARCHAR(64) NOT NULL,
  user_id         VARCHAR(64) NOT NULL,
  mode_label      VARCHAR(64) NOT NULL,
  consistency     DECIMAL(5,2) NOT NULL DEFAULT 0,
  distribution    JSON NOT NULL,
  evidence_chain  JSON NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (profile_id),
  INDEX idx_profiles_session (session_id),
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS action_scripts (
  script_id       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  profile_id      BIGINT UNSIGNED NULL,
  user_id         VARCHAR(64) NOT NULL,
  action_text     VARCHAR(512) NOT NULL,
  branches        JSON NOT NULL,
  fallback_text   VARCHAR(512) NOT NULL,
  stop_condition  VARCHAR(256) NOT NULL,
  based_on        INT NOT NULL DEFAULT 0,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (script_id),
  INDEX idx_scripts_user (user_id, created_at),
  CONSTRAINT fk_script_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS feedback (
  feedback_id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  script_id     BIGINT UNSIGNED NOT NULL,
  user_id       VARCHAR(64) NOT NULL,
  consent_id    BIGINT UNSIGNED NULL,
  executed      TINYINT(1) NULL,
  note          VARCHAR(512) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (feedback_id),
  INDEX idx_feedback_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS role_cards (
  card_id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     VARCHAR(64) NOT NULL,
  version     INT NOT NULL DEFAULT 1,
  params      JSON NOT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (card_id),
  UNIQUE KEY uq_rolecard_user (user_id),
  CONSTRAINT fk_rolecard_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- PRD §5.2：关系知识存边表，用 WITH RECURSIVE 参数化遍历；不把结构推理伪装成向量相似度
CREATE TABLE IF NOT EXISTS kg_edges (
  edge_id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_id    VARCHAR(128) NOT NULL,
  target_id    VARCHAR(128) NOT NULL,
  relationship VARCHAR(64)  NOT NULL,
  weight       DECIMAL(4,3) NOT NULL DEFAULT 1.000,
  PRIMARY KEY (edge_id),
  UNIQUE KEY uq_edge_triple (source_id, target_id, relationship),
  INDEX idx_edges_source (source_id, relationship),
  INDEX idx_edges_target (target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 唯一键 + INSERT IGNORE：每次启动执行 init_schema 也不会重复插入种子边
INSERT IGNORE INTO kg_edges (source_id, target_id, relationship, weight) VALUES
  ('stressor:临时取消', 'pattern:说出来，好好说', 'TRIGGERS', 0.800),
  ('stressor:临时取消', 'pattern:不回应，冷处理', 'TRIGGERS', 0.500),
  ('stressor:热度下降', 'pattern:先忍着，等一等', 'TRIGGERS', 0.700),
  ('stressor:边界模糊', 'pattern:说出来，带点刺', 'TRIGGERS', 0.600),
  ('pattern:说出来，好好说', 'outcome:边界更清楚', 'LONG_TERM_TRAJECTORY', 0.750),
  ('pattern:不回应，冷处理', 'outcome:误会累积', 'LONG_TERM_TRAJECTORY', 0.650),
  ('outcome:误会累积', 'pattern:说出来，带点刺', 'CONTRA_INDICATED_FOR', 0.400);

-- B 端只查这张聚合表，不接触 C 端明细（PRD §7.2）
CREATE TABLE IF NOT EXISTS aggregate_snapshots (
  snapshot_id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id     VARCHAR(64) NOT NULL,
  batch_label   VARCHAR(32) NOT NULL,
  option_code   VARCHAR(16) NOT NULL,
  choice_count  INT UNSIGNED NOT NULL,
  sample_size   INT UNSIGNED NOT NULL,
  computed_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (snapshot_id),
  INDEX idx_agg_tenant_batch (tenant_id, batch_label)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 前端 5 个上报节点的统一落点；payload 用 JSON 类型，不假设前端字段结构
CREATE TABLE IF NOT EXISTS session_events (
  event_id    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     VARCHAR(64) NOT NULL,
  session_id  VARCHAR(64) NOT NULL DEFAULT '',
  event_kind  VARCHAR(32) NOT NULL,
  payload     JSON NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_id),
  INDEX idx_events_user (user_id, created_at),
  INDEX idx_events_kind (event_kind, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
