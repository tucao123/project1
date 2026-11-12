"""配置层单测：纯标准库，不需要安装任何第三方依赖。

运行：python -m unittest discover -s server -p "test_*.py"
"""

from __future__ import annotations

import os
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

from server import config  # noqa: E402

_KEYS = (
    "SERVER_ENV_FILE", "LLM_API_KEY", "FEEDBACK_CONSENT_DEFAULT",
    "EMBEDDING_DIMENSIONS", "EMBEDDING_BATCH_SIZE", "LANGGRAPH_MAX_REWRITE",
    "MYSQL_HOST", "MYSQL_PASSWORD", "SERVER_PORT", "AGGREGATE_MIN_SAMPLE",
)


class ConfigTest(unittest.TestCase):
    def setUp(self):
        self._saved = {k: os.environ.pop(k, None) for k in _KEYS}
        self.tmp = tempfile.NamedTemporaryFile("w", suffix=".env", delete=False, encoding="utf-8")
        self.tmp.close()
        os.environ["SERVER_ENV_FILE"] = self.tmp.name

    def tearDown(self):
        os.environ.pop("SERVER_ENV_FILE", None)
        for key, value in self._saved.items():
            if value is not None:
                os.environ[key] = value
        pathlib.Path(self.tmp.name).unlink(missing_ok=True)
        config.reload()

    def _write(self, text: str):
        pathlib.Path(self.tmp.name).write_text(text, encoding="utf-8")
        config.reload()
        return config.get_settings()

    def test_defaults_are_degraded_but_valid(self):
        s = self._write("")
        self.assertEqual(s.port, 8000)
        self.assertEqual(s.embedding_dimensions, 1024)
        self.assertEqual(s.embedding_batch_size, 10)
        self.assertFalse(s.llm_ready)
        self.assertFalse(s.feedback_consent_default)
        self.assertTrue(any("未配置" in x for x in config.degradation_report(s)))

    def test_consent_default_is_forced_off(self):
        s = self._write("FEEDBACK_CONSENT_DEFAULT=true\n")
        self.assertFalse(s.feedback_consent_default)
        self.assertTrue(any("单独授权" in w for w in config.WARNINGS))

    def test_embedding_dimension_falls_back(self):
        s = self._write("EMBEDDING_DIMENSIONS=999\n")
        self.assertEqual(s.embedding_dimensions, 1024)
        self.assertTrue(any("EMBEDDING_DIMENSIONS" in w for w in config.WARNINGS))

    def test_batch_and_crag_are_capped(self):
        s = self._write("EMBEDDING_BATCH_SIZE=50\nLANGGRAPH_MAX_REWRITE=9\n")
        self.assertEqual(s.embedding_batch_size, config.EMBEDDING_BATCH_HARD_CAP)
        self.assertEqual(s.max_rewrite, 2)

    def test_env_overrides_file(self):
        self._write("MYSQL_HOST=from-file\n")
        os.environ["MYSQL_HOST"] = "from-env"
        config.reload()
        self.assertEqual(config.get_settings().mysql_host, "from-env")

    def test_public_dict_hides_secrets(self):
        self._write("LLM_API_KEY=sk-should-not-leak\nMYSQL_PASSWORD=hunter2\n")
        data = config.public_dict()
        self.assertEqual(data["llm_api_key"], "(configured)")
        self.assertEqual(data["mysql_password"], "(configured)")
        self.assertNotIn("sk-should-not-leak", str(data))

    def test_comments_and_quotes_are_parsed(self):
        s = self._write("# comment\nSERVER_PORT=\"8123\"\nLOG_LEVEL='debug'\n")
        self.assertEqual(s.port, 8123)
        self.assertEqual(s.log_level, "debug")

    def test_batch_plan_never_exceeds_hard_cap(self):
        import math
        self._write("EMBEDDING_BATCH_SIZE=50\n")
        plan = config.get_settings()
        from server import embedding
        result = embedding.batch_plan(35)
        self.assertLessEqual(result["batch_size"], config.EMBEDDING_BATCH_HARD_CAP)
        self.assertEqual(result["batches"], math.ceil(35 / result["batch_size"]))
        self.assertEqual(result["dimensions"], plan.embedding_dimensions)


if __name__ == "__main__":
    unittest.main()
