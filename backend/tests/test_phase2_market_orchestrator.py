"""Automated verification tests for Phase 2: LangGraph State Machine, Supervisor & Market Strategist."""

import unittest

from fastapi.testclient import TestClient

from app.agents.orchestrator import careerloop_graph
from app.main import app


class TestPhase2MarketOrchestrator(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def test_01_sophia_vance_full_stack_gap_analysis(self) -> None:
        demo_res = self.client.post("/api/profile/demo-persona")
        self.assertEqual(demo_res.status_code, 200)
        demo_data = demo_res.json()
        user_id = demo_data["user_id"]

        gap_res = self.client.post(
            "/api/market/analyze-gaps",
            json={"user_id": user_id, "target_role": "Full Stack Developer"},
        )
        self.assertEqual(gap_res.status_code, 200)
        data = gap_res.json()

        self.assertEqual(data["target_role"], "Full Stack Developer")
        self.assertGreaterEqual(data["readiness_score"], 50.0)
        self.assertLessEqual(data["readiness_score"], 65.0)

        matched = set(data["matched_verified_skills"])
        self.assertTrue({"Python", "SQL", "HTML & CSS"}.issubset(matched))

        gap_names = {g["skill_name"] for g in data["skill_gaps"]}
        self.assertTrue({"JavaScript ES6+ & Async", "React 19", "Node.js & Express"}.issubset(gap_names))

    def test_02_switch_role_to_ai_engineer(self) -> None:
        demo_res = self.client.post("/api/profile/demo-persona")
        self.assertEqual(demo_res.status_code, 200)
        user_id = demo_res.json()["user_id"]

        switch_res = self.client.post(
            "/api/market/switch-role",
            json={"user_id": user_id, "new_target_role": "AI Engineer"},
        )
        self.assertEqual(switch_res.status_code, 200)
        data = switch_res.json()

        self.assertEqual(data["target_role"], "AI Engineer")
        matched = set(data["matched_verified_skills"])
        self.assertTrue({"Python", "SQL"}.issubset(matched))

        gap_names = {g["skill_name"] for g in data["skill_gaps"]}
        self.assertTrue(
            {
                "PyTorch & Deep Learning",
                "LLM Orchestration & LangGraph",
                "Vector Databases & RAG",
            }.issubset(gap_names)
        )

    def test_03_supervisor_and_market_strategist_handoff_logs(self) -> None:
        self.assertIsNotNone(careerloop_graph)

        demo_res = self.client.post("/api/profile/demo-persona")
        self.assertEqual(demo_res.status_code, 200)
        user_id = demo_res.json()["user_id"]

        gap_res = self.client.post(
            "/api/market/analyze-gaps",
            json={"user_id": user_id, "target_role": "Full Stack Developer"},
        )
        self.assertEqual(gap_res.status_code, 200)
        logs = gap_res.json()["agent_logs"]

        agent_names = {entry["agent_name"] for entry in logs}
        self.assertIn("Supervisor", agent_names)
        self.assertIn("Market Strategist", agent_names)

        supervisor_summaries = [
            entry["action_summary"] for entry in logs if entry["agent_name"] == "Supervisor"
        ]
        self.assertTrue(any("Market Strategist" in s for s in supervisor_summaries))


if __name__ == "__main__":
    unittest.main()
