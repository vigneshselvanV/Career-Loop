from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.agents.profiler_agent import (
    extract_and_generate_diagnostic,
    get_stored_profile,
    load_demo_persona,
    verify_baseline_skills,
)
from app.schemas.profiler_schemas import (
    DiagnosticSubmissionRequest,
    ProfileUploadResponse,
    VerifiedProfileResponse,
)

router = APIRouter(prefix="/api/profile", tags=["Profiler & Verification"])


@router.post(
    "/upload",
    response_model=ProfileUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload LinkedIn/Resume PDF and generate 60-second baseline diagnostic",
)
async def upload_profile_pdf(
    file: UploadFile = File(..., description="LinkedIn or resume PDF document."),
    target_role: str = Form("Full Stack Developer", description="Candidate target role."),
    user_id: Optional[str] = Form(None, description="Optional existing candidate UUID."),
) -> ProfileUploadResponse:
    if file.content_type and "pdf" not in file.content_type.lower():
        if not (file.filename and file.filename.lower().endswith(".pdf")):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are supported for LinkedIn/resume extraction.",
            )

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded PDF file is empty.",
        )
    if len(pdf_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Uploaded PDF exceeds the 10 MB size limit.",
        )

    try:
        return await extract_and_generate_diagnostic(
            pdf_bytes=pdf_bytes,
            target_role=target_role.strip() or "Full Stack Developer",
            user_id=user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Profile extraction failed: {exc}",
        ) from exc


@router.post(
    "/verify-diagnostic",
    response_model=VerifiedProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Grade 60-second baseline quiz and persist verified skill profile",
)
async def verify_diagnostic(payload: DiagnosticSubmissionRequest) -> VerifiedProfileResponse:
    try:
        return await verify_baseline_skills(
            user_id=payload.user_id,
            quiz=payload.quiz,
            user_answers=payload.user_answers,
            target_role=payload.target_role,
            extracted_profile=payload.extracted_profile,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Diagnostic verification failed: {exc}",
        ) from exc


@router.post(
    "/demo-persona",
    response_model=VerifiedProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="1-Click Demo Persona loader for Sophia Vance (Full Stack Developer)",
)
async def demo_persona() -> VerifiedProfileResponse:
    return load_demo_persona()


@router.get(
    "/{user_id}",
    response_model=VerifiedProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Fetch verified profile and skills by user ID",
)
async def fetch_profile(user_id: str) -> VerifiedProfileResponse:
    profile = get_stored_profile(user_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile '{user_id}' not found.",
        )
    return profile
