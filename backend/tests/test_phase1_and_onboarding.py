"""Automated verification tests for Phase 1 & AI Onboarding endpoints."""

import unittest

from fastapi.testclient import TestClient

from app.main import app


class TestPhase1AndOnboarding(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.client = TestClient(app)

    def test_01_onboarding_analyze_generates_calibrated_quiz(self) -> None:
        res = self.client.post(
            "/api/onboarding/analyze",
            json={
                "user_id": "test-user-onboarding",
                "full_name": "Jordan Lee",
                "target_role": "Full Stack Developer",
                "batch_cohort": "Batch 2027",
                "experience_level": "Student",
                "background_note": "Built a Python and PostgreSQL course scheduler with HTML and CSS.",
                "selected_skills": ["Python", "SQL"],
            },
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()

        self.assertIn("Jordan", data["coach_message"])
        self.assertTrue(len(data["suggested_skills"]) >= 2)
        self.assertEqual(len(data["diagnostic_quiz"]["questions"]), 3)
        self.assertEqual(data["diagnostic_quiz"]["estimated_seconds"], 60)

        quiz = data["diagnostic_quiz"]
        correct_answers = [q["correct_index"] for q in quiz["questions"]]
        verify_res = self.client.post(
            "/api/profile/verify-diagnostic",
            json={
                "user_id": "test-user-onboarding",
                "target_role": "Full Stack Developer",
                "quiz": quiz,
                "user_answers": correct_answers,
            },
        )
        self.assertEqual(verify_res.status_code, 200)
        verified = verify_res.json()
        self.assertEqual(verified["quiz_score_percent"], 100.0)
        self.assertGreaterEqual(len(verified["verified_skills"]), 2)

    def test_02_upload_rejects_oversized_pdf_over_10mb(self) -> None:
        oversized = b"%PDF-1.4\n" + (b"0" * (10 * 1024 * 1024 + 64))
        res = self.client.post(
            "/api/profile/upload",
            data={"target_role": "Full Stack Developer"},
            files={"file": ("oversized.pdf", oversized, "application/pdf")},
        )
        self.assertEqual(res.status_code, 413)

    def test_03_upload_rejects_empty_pdf(self) -> None:
        res = self.client.post(
            "/api/profile/upload",
            data={"target_role": "Full Stack Developer"},
            files={"file": ("empty.pdf", b"", "application/pdf")},
        )
        self.assertEqual(res.status_code, 400)

    def test_04_agent_stream_sse_emits_steps_and_complete(self) -> None:
        demo_res = self.client.post("/api/profile/demo-persona")
        self.assertEqual(demo_res.status_code, 200)
        user_id = demo_res.json()["user_id"]

        with self.client.stream(
            "POST",
            "/api/agent/stream",
            json={
                "user_id": user_id,
                "requested_action": "build_roadmap",
                "target_role": "Full Stack Developer",
            },
        ) as stream_res:
            self.assertEqual(stream_res.status_code, 200)
            body = "".join(stream_res.iter_text())
            self.assertIn("agent_step", body)
            self.assertIn("complete", body)


if __name__ == "__main__":
    unittest.main()
