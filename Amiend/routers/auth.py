"""Authentication router exposing register/login/refresh/logout endpoints."""

from __future__ import annotations

import shutil
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, Response, UploadFile, status

from dependencies.providers import AuthServiceDep, CurrentUserIdDep
from infrastructure.models.user import (
    AccountDeleteRequest,
    ChangePasswordRequest,
    EmailSendRequest,
    EmailVerificationResponse,
    EmailVerifyRequest,
    LogoutRequest,
    PasswordLoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    SmsSendRequest,
    SmsVerificationResponse,
    SmsVerifyRequest,
    TokenPair,
    UpdateContactRequest,
    UpdateProfileRequest,
    UserResponse,
)


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=TokenPair,
    status_code=status.HTTP_201_CREATED,
    summary="注册并返回令牌（需邮箱+验证码凭证）",
    description="注册流程：先发送并验证邮箱获取verification_ticket，再携带邮箱、用户名、密码和ticket完成注册，直接返回access/refresh token。",
)
async def register_user(
    payload: RegisterRequest,
    auth_service: AuthServiceDep,
) -> TokenPair:
    """Register a new user with verified email."""

    return await auth_service.register(payload)


@router.post(
    "/login",
    response_model=TokenPair,
    summary="密码登录（用户名或手机号+密码）",
    description="使用用户名或手机号加密码登录，返回access/refresh token。",
)
async def login_user(
    payload: PasswordLoginRequest,
    auth_service: AuthServiceDep,
) -> TokenPair:
    """Authenticate user credentials and issue token pair."""

    return await auth_service.login_with_password(payload)


@router.post(
    "/email/send",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="发送邮箱验证码",
    description="根据scene（register/login/account_delete）向指定邮箱发送验证码，支持频率限制。",
)
async def send_email_code(
    payload: EmailSendRequest,
    auth_service: AuthServiceDep,
) -> Response:
    """Send an email verification code for the requested scene."""

    await auth_service.send_email_code(payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/email/verify",
    response_model=EmailVerificationResponse,
    summary="验证邮箱验证码",
    description="校验验证码：scene=login 时直接返回 TokenPair，scene=register/account_delete 返回一次性 verification_ticket。",
)
async def verify_email_code(
    payload: EmailVerifyRequest,
    auth_service: AuthServiceDep,
) -> EmailVerificationResponse:
    """Verify email code and issue token pair or ticket."""

    return await auth_service.verify_email_code(payload)


@router.post(
    "/sms/send",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="发送短信验证码",
    description="根据scene（register/login/account_delete）向指定手机号发送验证码，支持频率限制。",
)
async def send_sms_code(
    payload: SmsSendRequest,
    auth_service: AuthServiceDep,
) -> Response:
    """Send a verification code for the requested scene."""

    await auth_service.send_sms_code(payload)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/sms/verify",
    response_model=SmsVerificationResponse,
    summary="验证短信验证码",
    description="校验验证码：scene=login 时直接返回 TokenPair，scene=register/account_delete 返回一次性 verification_ticket。",
)
async def verify_sms_code(
    payload: SmsVerifyRequest,
    auth_service: AuthServiceDep,
) -> SmsVerificationResponse:
    """Verify SMS code and issue token pair or ticket."""

    return await auth_service.verify_sms_code(payload)


@router.post(
    "/refresh",
    response_model=TokenPair,
    summary="刷新令牌（一次性刷新策略）",
    description="使用 refresh_token 获取新的 token 对，旧 refresh_token 会立即失效。",
)
async def refresh_tokens(
    payload: RefreshTokenRequest,
    auth_service: AuthServiceDep,
) -> TokenPair:
    """Refresh an access token using one-time refresh token semantics."""

    return await auth_service.refresh(payload)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="登出（撤销刷新令牌）",
    description="提交 refresh_token 撤销当前会话的刷新令牌。",
)
async def logout_user(
    payload: LogoutRequest,
    auth_service: AuthServiceDep,
    current_user_id: CurrentUserIdDep,
) -> Response:
    """Invalidate the provided refresh token for the current user."""

    await auth_service.logout(payload, current_user_id=current_user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/account/delete",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="注销账号（密码或短信凭证）",
    description="通过当前登录用户身份，使用密码或短信验证码凭证注销账号；需 JWT 鉴权。",
)
async def delete_account(
    payload: AccountDeleteRequest,
    auth_service: AuthServiceDep,
    current_user_id: CurrentUserIdDep,
) -> Response:
    """Deactivate an account after verifying password or SMS ticket."""

    await auth_service.delete_account(payload, user_id=current_user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="修改密码（原密码或验证码）",
    description="当前登录用户可通过原密码，或邮箱/短信验证码 ticket 修改密码。需 JWT 鉴权。",
)
async def change_password(
    payload: ChangePasswordRequest,
    auth_service: AuthServiceDep,
    current_user_id: CurrentUserIdDep,
) -> Response:
    """Change the current user's password."""

    await auth_service.change_password(payload, str(current_user_id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/me",
    response_model=UserResponse,
    summary="查询当前用户信息",
    description="通过当前登录用户的身份获取用户信息。",
)
async def get_me(
    auth_service: AuthServiceDep,
    current_user_id: CurrentUserIdDep,
) -> UserResponse:
    """Return the profile of the current user."""

    return await auth_service.get_me(str(current_user_id))


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="更新当前用户个人资料",
    description="更新全局 Profile 中展示的昵称和头像地址。需 JWT 鉴权。",
)
async def update_me(
    payload: UpdateProfileRequest,
    auth_service: AuthServiceDep,
    current_user_id: CurrentUserIdDep,
) -> UserResponse:
    """Update profile fields for the current user."""

    return await auth_service.update_profile(payload, str(current_user_id))


@router.patch(
    "/me/contact",
    response_model=UserResponse,
    summary="修改绑定邮箱或手机号",
    description="修改邮箱需先对新邮箱完成 register 场景邮箱验证码验证；修改手机号需先对新手机号完成 register 场景短信验证码验证。",
)
async def update_contact(
    payload: UpdateContactRequest,
    auth_service: AuthServiceDep,
    current_user_id: CurrentUserIdDep,
) -> UserResponse:
    """Update bound email or phone for the current user."""

    return await auth_service.update_contact(payload, str(current_user_id))


@router.post(
    "/me/avatar",
    response_model=UserResponse,
    summary="上传头像",
    description="上传当前用户头像文件，服务端保存到 static/avatars 并更新 avatar_url。",
)
async def upload_avatar(
    auth_service: AuthServiceDep,
    current_user_id: CurrentUserIdDep,
    file: UploadFile = File(...),
) -> UserResponse:
    """Upload and bind an avatar image for the current user."""

    content_type = file.content_type or ""
    if not content_type.startswith("image/"):
        from core.exceptions import InvalidCredentialsError

        raise InvalidCredentialsError(message="头像必须是图片文件。")

    extension = Path(file.filename or "").suffix.lower()
    if extension not in {".jpg", ".jpeg", ".png", ".webp"}:
        extension = ".jpg"

    avatar_dir = Path("static") / "avatars"
    avatar_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{current_user_id}-{uuid4().hex}{extension}"
    target = avatar_dir / filename
    with target.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    await file.close()

    avatar_url = f"/static/avatars/{filename}"
    return await auth_service.update_profile(
        UpdateProfileRequest(avatar_url=avatar_url),
        str(current_user_id),
    )
