"""Automated verification tests for Phase 3 & 4: DAG Roadmap, Quiz Grading & Adaptive Re-routing."""

import unittest

from fastapi.testclient import TestClient

from app.main import app


class TestPhase3And4AdaptiveFlow(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def test_01_build_roadmap_and_simulate_40_percent_reroute(self) -> None:
        demo_res = self.client.post("/api/profile/demo-persona")
        self.assertEqual(demo_res.status_code, 200)
        user_id = demo_res.json()["user_id"]

        build_res = self.client.post(
            "/api/roadmap/build",
            json={"user_id": user_id, "target_role": "Full Stack Developer"},
        )
        self.assertEqual(build_res.status_code, 200)
        initial_nodes = build_res.json()["roadmap"]["nodes"]
        initial_labels = {n["data"]["label"] for n in initial_nodes}
        self.assertIn("JavaScript ES6+ & Async", initial_labels)
        self.assertNotIn("JavaScript Fundamentals", initial_labels)

        fail_res = self.client.post(
            "/api/mentor/quiz/simulate-fail",
            json={"user_id": user_id, "topic": "JavaScript ES6+ & Async", "score_percent": 40.0},
        )
        self.assertEqual(fail_res.status_code, 200)
        fail_data = fail_res.json()
        self.assertFalse(fail_data["passed"])
        self.assertTrue(fail_data["needs_reroute"])
        self.assertIsNotNone(fail_data["updated_roadmap"])

        updated_nodes = fail_data["updated_roadmap"]["nodes"]
        remediation_node = next(
            (n for n in updated_nodes if n["data"]["label"] == "JavaScript Fundamentals"),
            None,
        )
        self.assertIsNotNone(remediation_node)
        self.assertEqual(remediation_node["data"]["status"], "remediation")
        self.assertIn("40%", remediation_node["data"]["badge_text"])

    def test_02_mentor_socratic_chat_and_cohort_analytics(self) -> None:
        demo_res = self.client.post("/api/profile/demo-persona")
        self.assertEqual(demo_res.status_code, 200)
        user_id = demo_res.json()["user_id"]

        chat_res = self.client.post(
            "/api/mentor/chat",
            json={
                "user_id": user_id,
                "topic": "JavaScript ES6+ & Async",
                "message": "How do Promises differ from blocking Python calls?",
                "history": [],
            },
        )
        self.assertEqual(chat_res.status_code, 200)
        self.assertTrue(len(chat_res.json()["reply"]) > 20)

        cohort_res = self.client.get("/api/analytics/cohort")
        self.assertEqual(cohort_res.status_code, 200)
        self.assertGreaterEqual(len(cohort_res.json()["students"]), 5)


if __name__ == "__main__":
    unittest.main()
