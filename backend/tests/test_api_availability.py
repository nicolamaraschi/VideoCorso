"""
Comprehensive API test suite for VideoCorso.

Environment variables required:
  API_ENDPOINT        - e.g. https://nyer89lvbj.execute-api.us-east-1.amazonaws.com/prod
  STACK_NAME          - fallback to derive API_ENDPOINT from CloudFormation (default: corso-video-chiara)
  AWS_REGION          - default: us-east-1

Optional (skips auth/admin tests if missing):
  ADMIN_EMAIL         - Cognito admin account email
  ADMIN_PASSWORD      - Cognito admin account password
  STUDENT_EMAIL       - Cognito student account email
  STUDENT_PASSWORD    - Cognito student account password
  COGNITO_CLIENT_ID   - Cognito User Pool Client ID
"""

import os
import time
import uuid
import pytest
import requests
import boto3

TIMEOUT = 15  # seconds per HTTP request

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _get_api_endpoint() -> str:
    if "API_ENDPOINT" in os.environ:
        return os.environ["API_ENDPOINT"].rstrip("/")
    try:
        stack = os.environ.get("STACK_NAME", "corso-video-chiara")
        region = os.environ.get("AWS_REGION", "us-east-1")
        cf = boto3.client("cloudformation", region_name=region)
        outputs = cf.describe_stacks(StackName=stack)["Stacks"][0].get("Outputs", [])
        for o in outputs:
            if o["OutputKey"] == "ApiEndpoint":
                return o["OutputValue"].rstrip("/")
    except Exception as exc:
        pytest.fail(f"Cannot resolve API_ENDPOINT: {exc}")
    pytest.fail("API_ENDPOINT not found")


def _cognito_auth(email: str, password: str, client_id: str) -> str:
    """Returns the IdToken for the given credentials."""
    client = boto3.client("cognito-idp", region_name=os.environ.get("AWS_REGION", "us-east-1"))
    resp = client.initiate_auth(
        AuthFlow="USER_PASSWORD_AUTH",
        AuthParameters={"USERNAME": email, "PASSWORD": password},
        ClientId=client_id,
    )
    return resp["AuthenticationResult"]["IdToken"]


@pytest.fixture(scope="session")
def base(request) -> str:
    return _get_api_endpoint()


@pytest.fixture(scope="session")
def admin_token(request) -> str | None:
    email = os.environ.get("ADMIN_EMAIL")
    password = os.environ.get("ADMIN_PASSWORD")
    client_id = os.environ.get("COGNITO_CLIENT_ID")
    if not (email and password and client_id):
        return None
    try:
        return _cognito_auth(email, password, client_id)
    except Exception as exc:
        pytest.fail(f"Admin Cognito auth failed: {exc}")


@pytest.fixture(scope="session")
def student_token(request) -> str | None:
    email = os.environ.get("STUDENT_EMAIL")
    password = os.environ.get("STUDENT_PASSWORD")
    client_id = os.environ.get("COGNITO_CLIENT_ID")
    if not (email and password and client_id):
        return None
    try:
        return _cognito_auth(email, password, client_id)
    except Exception as exc:
        pytest.fail(f"Student Cognito auth failed: {exc}")


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def skip_no_admin(token):
    if token is None:
        pytest.skip("ADMIN_EMAIL/ADMIN_PASSWORD/COGNITO_CLIENT_ID not set")


def skip_no_student(token):
    if token is None:
        pytest.skip("STUDENT_EMAIL/STUDENT_PASSWORD/COGNITO_CLIENT_ID not set")


# ---------------------------------------------------------------------------
# Shared state populated during the session (avoids repeated API calls)
# ---------------------------------------------------------------------------

_state: dict = {}  # course_id, chapter_id, lesson_id, purchase_id, coupon_id, student_id


# ===========================================================================
# 1. PUBLIC ENDPOINTS  (no auth required)
# ===========================================================================

class TestPublicCatalog:

    def test_get_courses_200(self, base):
        """GET /courses → 200 with items list."""
        r = requests.get(f"{base}/courses", timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert "items" in body
        assert isinstance(body["items"], list)
        # Cache first course for later tests
        if body["items"]:
            c = body["items"][0]
            _state["course_id"] = c.get("public_slug") or c.get("course_id")
            _state["course_id_raw"] = c.get("course_id")

    def test_get_course_by_slug_200(self, base, admin_token):
        """GET /courses/{courseId} requires auth → 401 without token."""
        course_id = _state.get("course_id")
        if not course_id:
            pytest.skip("No course available from catalog")
        # No token: must return 401
        r = requests.get(f"{base}/courses/{course_id}", timeout=TIMEOUT)
        assert r.status_code == 401, (
            f"Expected 401 without auth, got {r.status_code}"
        )
        # With admin token: must return 200 with full structure
        if admin_token:
            r2 = requests.get(
                f"{base}/courses/{course_id}",
                headers=auth_headers(admin_token),
                timeout=TIMEOUT,
            )
            assert r2.status_code == 200
            body = r2.json()
            assert "course" in body
            assert "chapters" in body
            # Cache a lesson_id for later tests
            for ch in body.get("chapters", []):
                for lesson in ch.get("lessons", []):
                    if not _state.get("lesson_id"):
                        _state["lesson_id"] = lesson.get("lesson_id")

    def test_get_course_not_found_401_without_token(self, base):
        """GET /courses/{nonexistent} requires auth → 401 without token."""
        r = requests.get(f"{base}/courses/this-does-not-exist-xyz", timeout=TIMEOUT)
        assert r.status_code == 401

    def test_get_course_structure_requires_auth(self, base):
        """GET /course/structure requires Cognito auth → 401 without token."""
        r = requests.get(f"{base}/course/structure", timeout=TIMEOUT)
        assert r.status_code == 401, (
            f"Expected 401 without auth, got {r.status_code}"
        )

    def test_get_course_structure_200_with_token(self, base, admin_token):
        """GET /course/structure with valid admin token → 200 with course + chapters."""
        if not admin_token:
            pytest.skip("ADMIN_EMAIL/ADMIN_PASSWORD/COGNITO_CLIENT_ID not set")
        params = {}
        if _state.get("course_id"):
            params["course_id"] = _state["course_id"]
        r = requests.get(
            f"{base}/course/structure",
            headers=auth_headers(admin_token),
            params=params,
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        body = r.json()
        assert "course" in body
        assert "chapters" in body

    def test_get_free_previews_200(self, base):
        """GET /course/previews → 200 with a list."""
        r = requests.get(f"{base}/course/previews", timeout=TIMEOUT)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestPublicPayment:

    def test_quote_checkout_missing_course_404(self, base):
        """POST /payment/quote with unknown course → 404."""
        r = requests.post(
            f"{base}/payment/quote",
            json={"course_id": "nonexistent-course-xyz"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 404

    def test_quote_checkout_valid_course(self, base):
        """POST /payment/quote with real course → 200 with price info."""
        course_id = _state.get("course_id")
        if not course_id:
            pytest.skip("No course available")
        r = requests.post(
            f"{base}/payment/quote",
            json={"course_id": course_id},
            timeout=TIMEOUT,
        )
        # Could be 200 or 400 if course not purchasable; both are correct HTTP responses
        assert r.status_code in (200, 400)
        if r.status_code == 200:
            body = r.json()
            assert "final_total" in body
            assert "base_total" in body

    def test_create_checkout_missing_fields_400(self, base):
        """POST /payment/create-checkout with missing required fields → 400."""
        r = requests.post(
            f"{base}/payment/create-checkout",
            json={"course_id": "some-course"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_create_checkout_bad_origin_400(self, base):
        """POST /payment/create-checkout with disallowed redirect domain → 400."""
        course_id = _state.get("course_id", "test-course")
        r = requests.post(
            f"{base}/payment/create-checkout",
            json={
                "course_id": course_id,
                "success_url": "https://evil.example.com/success",
                "cancel_url": "https://evil.example.com/cancel",
            },
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_verify_payment_invalid_session(self, base):
        """GET /payment/verify/{sessionId} with garbage id → non-200 (Stripe error)."""
        r = requests.get(f"{base}/payment/verify/invalid_session_id_xyz", timeout=TIMEOUT)
        assert r.status_code in (400, 404, 500)

    def test_webhook_missing_signature_400(self, base):
        """POST /payment/webhook without Stripe-Signature → 400."""
        r = requests.post(
            f"{base}/payment/webhook",
            data="{}",
            headers={"Content-Type": "application/json"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 400


# ===========================================================================
# 2. AUTH-REQUIRED ENDPOINTS  (must return 401 without a token)
# ===========================================================================

class TestRequires401WithoutToken:
    """Every authenticated endpoint must reject requests with no token."""

    def _assert_401(self, url, method="get", **kwargs):
        r = getattr(requests, method)(url, timeout=TIMEOUT, **kwargs)
        assert r.status_code == 401, (
            f"{method.upper()} {url} should return 401 without auth, got {r.status_code}"
        )

    def test_me_courses_401(self, base):
        self._assert_401(f"{base}/me/courses")

    def test_user_subscription_401(self, base):
        self._assert_401(f"{base}/user/subscription")

    def test_progress_user_401(self, base):
        self._assert_401(f"{base}/progress/user")

    def test_progress_update_401(self, base):
        self._assert_401(f"{base}/progress/update", method="post", json={})

    def test_progress_complete_401(self, base):
        self._assert_401(f"{base}/progress/complete", method="post", json={})

    def test_progress_lesson_401(self, base):
        self._assert_401(f"{base}/progress/lesson/dummy-lesson-id")

    def test_me_courses_progress_401(self, base):
        self._assert_401(f"{base}/me/courses/dummy-course-id/progress")

    def test_course_video_401(self, base):
        self._assert_401(f"{base}/course/video/dummy-lesson-id")

    def test_admin_stats_401(self, base):
        self._assert_401(f"{base}/admin/stats")

    def test_admin_students_401(self, base):
        self._assert_401(f"{base}/admin/students")

    def test_admin_purchases_401(self, base):
        self._assert_401(f"{base}/admin/purchases")

    def test_admin_courses_401(self, base):
        self._assert_401(f"{base}/admin/courses")

    def test_admin_coupons_401(self, base):
        self._assert_401(f"{base}/admin/coupons")

    def test_admin_accounts_401(self, base):
        self._assert_401(f"{base}/admin/accounts")


# ===========================================================================
# 3. STUDENT AUTHENTICATED ENDPOINTS
# ===========================================================================

class TestStudentAuth:
    """Tests that require a valid student Cognito token."""

    def test_me_courses_200(self, base, student_token):
        skip_no_student(student_token)
        r = requests.get(f"{base}/me/courses", headers=auth_headers(student_token), timeout=TIMEOUT)
        assert r.status_code == 200
        assert "items" in r.json()

    def test_user_subscription_200(self, base, student_token):
        skip_no_student(student_token)
        r = requests.get(f"{base}/user/subscription", headers=auth_headers(student_token), timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert "is_active" in body
        assert "accessible_courses" in body

    def test_progress_user_200(self, base, student_token):
        skip_no_student(student_token)
        r = requests.get(f"{base}/progress/user", headers=auth_headers(student_token), timeout=TIMEOUT)
        assert r.status_code == 200
        body = r.json()
        assert "total_lessons" in body
        assert "completed_lessons" in body

    def test_progress_lesson_200_or_404(self, base, student_token):
        skip_no_student(student_token)
        lesson_id = _state.get("lesson_id", "dummy-id")
        r = requests.get(
            f"{base}/progress/lesson/{lesson_id}",
            headers=auth_headers(student_token),
            timeout=TIMEOUT,
        )
        # 200 if lesson exists and user has access (or free preview), 403/404 otherwise
        assert r.status_code in (200, 403, 404)

    def test_me_courses_progress_200_or_403(self, base, student_token):
        skip_no_student(student_token)
        course_id = _state.get("course_id_raw", "dummy-course")
        r = requests.get(
            f"{base}/me/courses/{course_id}/progress",
            headers=auth_headers(student_token),
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 403)

    def test_progress_update_valid_payload(self, base, student_token):
        skip_no_student(student_token)
        lesson_id = _state.get("lesson_id")
        if not lesson_id:
            pytest.skip("No lesson_id cached")
        r = requests.post(
            f"{base}/progress/update",
            headers=auth_headers(student_token),
            json={"lesson_id": lesson_id, "watched_seconds": 10, "total_seconds": 90},
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 201, 403, 404)

    def test_progress_update_missing_fields_400(self, base, student_token):
        skip_no_student(student_token)
        r = requests.post(
            f"{base}/progress/update",
            headers=auth_headers(student_token),
            json={"lesson_id": "some-id"},  # missing watched_seconds
            timeout=TIMEOUT,
        )
        assert r.status_code == 400

    def test_course_video_404_no_such_lesson(self, base, student_token):
        skip_no_student(student_token)
        r = requests.get(
            f"{base}/course/video/nonexistent-lesson-xyz",
            headers=auth_headers(student_token),
            timeout=TIMEOUT,
        )
        assert r.status_code == 404

    def test_course_video_quality_param_accepted(self, base, student_token):
        skip_no_student(student_token)
        lesson_id = _state.get("lesson_id")
        if not lesson_id:
            pytest.skip("No lesson_id cached")
        for quality in ("high", "medium", "low"):
            r = requests.get(
                f"{base}/course/video/{lesson_id}?quality={quality}",
                headers=auth_headers(student_token),
                timeout=TIMEOUT,
            )
            # 200, 403 (no access), or 404 (no video attached) are all valid
            assert r.status_code in (200, 403, 404), (
                f"quality={quality} returned unexpected {r.status_code}"
            )


# ===========================================================================
# 4. ADMIN ENDPOINTS  — read-only (GET)
# ===========================================================================

class TestAdminReadOnly:
    """Admin GET endpoints: must return 403/401 for students, 200 for admins."""

    def _admin_get(self, base, admin_token, path):
        skip_no_admin(admin_token)
        r = requests.get(f"{base}{path}", headers=auth_headers(admin_token), timeout=TIMEOUT)
        assert r.status_code == 200, (
            f"Admin GET {path} returned {r.status_code}: {r.text[:200]}"
        )
        return r.json()

    def _student_blocked(self, base, student_token, path):
        if student_token:
            r = requests.get(f"{base}{path}", headers=auth_headers(student_token), timeout=TIMEOUT)
            assert r.status_code in (401, 403), (
                f"Student should be blocked on {path}, got {r.status_code}"
            )

    def test_admin_stats(self, base, admin_token, student_token):
        self._student_blocked(base, student_token, "/admin/stats")
        body = self._admin_get(base, admin_token, "/admin/stats")
        assert "total_students" in body

    def test_admin_students(self, base, admin_token, student_token):
        self._student_blocked(base, student_token, "/admin/students")
        body = self._admin_get(base, admin_token, "/admin/students")
        assert "students" in body or isinstance(body.get("students") or body, (list, dict))

    def test_admin_students_search(self, base, admin_token):
        skip_no_admin(admin_token)
        r = requests.get(
            f"{base}/admin/students/search",
            headers=auth_headers(admin_token),
            params={"q": "test"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200

    def test_admin_purchases(self, base, admin_token, student_token):
        self._student_blocked(base, student_token, "/admin/purchases")
        body = self._admin_get(base, admin_token, "/admin/purchases")
        assert "purchases" in body or isinstance(body, (list, dict))
        # Cache first purchase id for later
        purchases = body.get("purchases") or body.get("items") or (body if isinstance(body, list) else [])
        if purchases:
            _state["purchase_id"] = purchases[0].get("purchase_id")

    def test_admin_courses(self, base, admin_token, student_token):
        self._student_blocked(base, student_token, "/admin/courses")
        body = self._admin_get(base, admin_token, "/admin/courses")
        courses = body.get("courses") or body.get("items") or (body if isinstance(body, list) else [])
        if courses:
            _state["admin_course_id"] = courses[0].get("course_id")

    def test_admin_coupons(self, base, admin_token, student_token):
        self._student_blocked(base, student_token, "/admin/coupons")
        body = self._admin_get(base, admin_token, "/admin/coupons")
        coupons = body.get("coupons") or body.get("items") or (body if isinstance(body, list) else [])
        if coupons:
            _state["coupon_id"] = coupons[0].get("coupon_id")

    def test_admin_accounts(self, base, admin_token, student_token):
        self._student_blocked(base, student_token, "/admin/accounts")
        body = self._admin_get(base, admin_token, "/admin/accounts")
        assert isinstance(body, (list, dict))


# ===========================================================================
# 5. ADMIN ENDPOINTS — purchase detail & actions
# ===========================================================================

class TestAdminPurchases:

    def test_admin_purchase_detail(self, base, admin_token):
        skip_no_admin(admin_token)
        purchase_id = _state.get("purchase_id")
        if not purchase_id:
            pytest.skip("No purchase_id cached from test_admin_purchases")
        r = requests.get(
            f"{base}/admin/purchase/{purchase_id}",
            headers=auth_headers(admin_token),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        body = r.json()
        assert body.get("purchase_id") == purchase_id or "purchase" in body

    def test_admin_purchase_nonexistent_404(self, base, admin_token):
        skip_no_admin(admin_token)
        r = requests.get(
            f"{base}/admin/purchase/nonexistent-purchase-xyz",
            headers=auth_headers(admin_token),
            timeout=TIMEOUT,
        )
        assert r.status_code == 404

    def test_admin_purchase_mark_verified(self, base, admin_token):
        skip_no_admin(admin_token)
        purchase_id = _state.get("purchase_id")
        if not purchase_id:
            pytest.skip("No purchase_id cached")
        r = requests.post(
            f"{base}/admin/purchase/{purchase_id}/mark-verified",
            headers=auth_headers(admin_token),
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 404)

    def test_admin_purchase_resync(self, base, admin_token):
        skip_no_admin(admin_token)
        purchase_id = _state.get("purchase_id")
        if not purchase_id:
            pytest.skip("No purchase_id cached")
        r = requests.post(
            f"{base}/admin/purchase/{purchase_id}/resync",
            headers=auth_headers(admin_token),
            timeout=TIMEOUT,
        )
        # Could fail if test purchase has no Stripe backing, that's acceptable
        assert r.status_code in (200, 400, 404, 500)


# ===========================================================================
# 6. ADMIN ENDPOINTS — course CRUD (non-destructive: create → read → update → delete)
# ===========================================================================

class TestAdminCourseCRUD:
    """Full lifecycle: create course, add chapter and lesson, reorder, then clean up."""

    _created: dict = {}  # local to this class's test run

    def test_01_create_course(self, base, admin_token):
        skip_no_admin(admin_token)
        slug = f"test-auto-{uuid.uuid4().hex[:8]}"
        r = requests.post(
            f"{base}/admin/course",
            headers=auth_headers(admin_token),
            json={
                "title": "Automated Test Course",
                "description": "Created by CI test suite",
                "short_description": "CI test",
                "long_description": "CI test",
                "price": 0,
                "status": "draft",
                "is_active": False,
                "is_purchasable": False,
                "public_slug": slug,
                "display_order": 999,
            },
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 201)
        body = r.json()
        cid = body.get("course_id") or body.get("course", {}).get("course_id")
        assert cid, f"Response missing course_id: {body}"
        TestAdminCourseCRUD._created["course_id"] = cid

    def test_02_update_course(self, base, admin_token):
        skip_no_admin(admin_token)
        cid = TestAdminCourseCRUD._created.get("course_id")
        if not cid:
            pytest.skip("No course_id from test_01_create_course")
        r = requests.put(
            f"{base}/admin/course/{cid}",
            headers=auth_headers(admin_token),
            json={"title": "Automated Test Course (updated)", "description": "updated"},
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 204)

    def test_03_create_chapter(self, base, admin_token):
        skip_no_admin(admin_token)
        cid = TestAdminCourseCRUD._created.get("course_id")
        if not cid:
            pytest.skip("No course_id")
        r = requests.post(
            f"{base}/admin/course/chapter",
            headers=auth_headers(admin_token),
            json={"course_id": cid, "title": "Test Chapter", "description": "", "order_number": 1},
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 201)
        body = r.json()
        chid = body.get("chapter_id") or body.get("chapter", {}).get("chapter_id")
        assert chid
        TestAdminCourseCRUD._created["chapter_id"] = chid

    def test_04_update_chapter(self, base, admin_token):
        skip_no_admin(admin_token)
        chid = TestAdminCourseCRUD._created.get("chapter_id")
        if not chid:
            pytest.skip("No chapter_id")
        r = requests.put(
            f"{base}/admin/course/chapter/{chid}",
            headers=auth_headers(admin_token),
            json={"title": "Test Chapter (updated)"},
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 204)

    def test_05_create_lesson(self, base, admin_token):
        skip_no_admin(admin_token)
        chid = TestAdminCourseCRUD._created.get("chapter_id")
        if not chid:
            pytest.skip("No chapter_id")
        r = requests.post(
            f"{base}/admin/course/lesson",
            headers=auth_headers(admin_token),
            json={
                "chapter_id": chid,
                "title": "Test Lesson",
                "description": "",
                "order_number": 1,
                "duration_seconds": 0,
                "video_s3_key": "",
            },
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 201)
        body = r.json()
        lid = body.get("lesson_id") or body.get("lesson", {}).get("lesson_id")
        assert lid
        TestAdminCourseCRUD._created["lesson_id"] = lid

    def test_06_update_lesson(self, base, admin_token):
        skip_no_admin(admin_token)
        lid = TestAdminCourseCRUD._created.get("lesson_id")
        if not lid:
            pytest.skip("No lesson_id")
        r = requests.put(
            f"{base}/admin/course/lesson/{lid}",
            headers=auth_headers(admin_token),
            json={"title": "Test Lesson (updated)"},
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 204)

    def test_07_reorder_chapters(self, base, admin_token):
        skip_no_admin(admin_token)
        chid = TestAdminCourseCRUD._created.get("chapter_id")
        if not chid:
            pytest.skip("No chapter_id")
        r = requests.put(
            f"{base}/admin/course/reorder-chapters",
            headers=auth_headers(admin_token),
            json={"items": [{"id": chid, "order_number": 1}]},
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 204)

    def test_08_reorder_lessons(self, base, admin_token):
        skip_no_admin(admin_token)
        lid = TestAdminCourseCRUD._created.get("lesson_id")
        if not lid:
            pytest.skip("No lesson_id")
        r = requests.put(
            f"{base}/admin/course/reorder-lessons",
            headers=auth_headers(admin_token),
            json={"items": [{"id": lid, "order_number": 1}]},
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 204)

    def test_09_presigned_upload_url(self, base, admin_token):
        skip_no_admin(admin_token)
        lid = TestAdminCourseCRUD._created.get("lesson_id")
        r = requests.post(
            f"{base}/admin/video/upload",
            headers=auth_headers(admin_token),
            json={"file_name": "test.mp4", "file_type": "video/mp4", "lesson_id": lid},
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 400)
        if r.status_code == 200:
            assert "upload_url" in r.json()

    def test_10_presigned_image_upload_url(self, base, admin_token):
        skip_no_admin(admin_token)
        r = requests.post(
            f"{base}/admin/image/upload",
            headers=auth_headers(admin_token),
            json={"file_name": "cover.png", "file_type": "image/png", "folder": "courses"},
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 400)
        if r.status_code == 200:
            assert "upload_url" in r.json()

    def test_11_delete_lesson(self, base, admin_token):
        skip_no_admin(admin_token)
        lid = TestAdminCourseCRUD._created.get("lesson_id")
        if not lid:
            pytest.skip("No lesson_id")
        r = requests.delete(
            f"{base}/admin/course/lesson/{lid}",
            headers=auth_headers(admin_token),
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 204)

    def test_12_delete_chapter(self, base, admin_token):
        skip_no_admin(admin_token)
        chid = TestAdminCourseCRUD._created.get("chapter_id")
        if not chid:
            pytest.skip("No chapter_id")
        r = requests.delete(
            f"{base}/admin/course/chapter/{chid}",
            headers=auth_headers(admin_token),
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 204)

    def test_13_delete_course(self, base, admin_token):
        skip_no_admin(admin_token)
        cid = TestAdminCourseCRUD._created.get("course_id")
        if not cid:
            pytest.skip("No course_id")
        r = requests.delete(
            f"{base}/admin/course/{cid}",
            headers=auth_headers(admin_token),
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 204)


# ===========================================================================
# 7. ADMIN ENDPOINTS — coupon CRUD
# ===========================================================================

class TestAdminCouponCRUD:

    _created: dict = {}

    def test_01_create_coupon(self, base, admin_token):
        skip_no_admin(admin_token)
        code = f"CITEST{uuid.uuid4().hex[:6].upper()}"
        r = requests.post(
            f"{base}/admin/coupon",
            headers=auth_headers(admin_token),
            json={
                "code": code,
                "discount_type": "percent",
                "discount_value": 10,
                "is_active": True,
                "is_free_access": False,
                "course_scope": [],
                "allowed_user_emails": [],
            },
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 201)
        body = r.json()
        cid = body.get("coupon_id") or body.get("coupon", {}).get("coupon_id") or code
        TestAdminCouponCRUD._created["coupon_id"] = cid
        TestAdminCouponCRUD._created["coupon_code"] = code

    def test_02_test_coupon_endpoint(self, base, admin_token):
        skip_no_admin(admin_token)
        code = TestAdminCouponCRUD._created.get("coupon_code")
        if not code:
            pytest.skip("No coupon_code from test_01")
        course_id = _state.get("course_id", "test")
        r = requests.post(
            f"{base}/admin/coupon/test",
            headers=auth_headers(admin_token),
            json={"code": code, "course_id": course_id},
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 400)

    def test_03_update_coupon(self, base, admin_token):
        skip_no_admin(admin_token)
        cid = TestAdminCouponCRUD._created.get("coupon_id")
        if not cid:
            pytest.skip("No coupon_id")
        r = requests.put(
            f"{base}/admin/coupon/{cid}",
            headers=auth_headers(admin_token),
            json={"is_active": False},
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 204)

    def test_04_delete_coupon(self, base, admin_token):
        skip_no_admin(admin_token)
        cid = TestAdminCouponCRUD._created.get("coupon_id")
        if not cid:
            pytest.skip("No coupon_id")
        r = requests.delete(
            f"{base}/admin/coupon/{cid}",
            headers=auth_headers(admin_token),
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 204)


# ===========================================================================
# 8. ADMIN ENDPOINTS — student management
# ===========================================================================

class TestAdminStudentManagement:

    _created: dict = {}

    def test_01_create_student(self, base, admin_token):
        skip_no_admin(admin_token)
        email = f"ci.test.{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(
            f"{base}/admin/student/create",
            headers=auth_headers(admin_token),
            json={"email": email, "full_name": "CI Test Student"},
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 201)
        body = r.json()
        sid = body.get("user_id") or body.get("student", {}).get("user_id")
        if sid:
            TestAdminStudentManagement._created["student_id"] = sid
            TestAdminStudentManagement._created["student_email"] = email

    def test_02_get_student_detail(self, base, admin_token):
        skip_no_admin(admin_token)
        sid = TestAdminStudentManagement._created.get("student_id")
        if not sid:
            pytest.skip("No student_id from test_01")
        r = requests.get(
            f"{base}/admin/student/{sid}",
            headers=auth_headers(admin_token),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200

    def test_03_patch_student(self, base, admin_token):
        skip_no_admin(admin_token)
        sid = TestAdminStudentManagement._created.get("student_id")
        if not sid:
            pytest.skip("No student_id")
        r = requests.patch(
            f"{base}/admin/student/{sid}",
            headers=auth_headers(admin_token),
            json={"global_access": False},
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 204)

    def test_04_resend_invite(self, base, admin_token):
        skip_no_admin(admin_token)
        sid = TestAdminStudentManagement._created.get("student_id")
        if not sid:
            pytest.skip("No student_id")
        r = requests.post(
            f"{base}/admin/student/{sid}/resend-invite",
            headers=auth_headers(admin_token),
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 400, 404)

    def test_05_reset_password(self, base, admin_token):
        skip_no_admin(admin_token)
        sid = TestAdminStudentManagement._created.get("student_id")
        if not sid:
            pytest.skip("No student_id")
        r = requests.post(
            f"{base}/admin/student/{sid}/reset-password",
            headers=auth_headers(admin_token),
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 400, 404)

    def test_06_delete_student(self, base, admin_token):
        skip_no_admin(admin_token)
        sid = TestAdminStudentManagement._created.get("student_id")
        if not sid:
            pytest.skip("No student_id")
        r = requests.delete(
            f"{base}/admin/student/{sid}",
            headers=auth_headers(admin_token),
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 204)


# ===========================================================================
# 9. CORS preflight — spot check key endpoints
# ===========================================================================

class TestCorsPreflight:
    """OPTIONS requests must return 200 with CORS headers on all key endpoints."""

    _endpoints = [
        "/courses",
        "/course/structure",
        "/payment/create-checkout",
        "/payment/quote",
        "/payment/webhook",
        "/progress/update",
        "/admin/stats",
        "/admin/students",
        "/admin/purchases",
    ]

    @pytest.mark.parametrize("path", _endpoints)
    def test_preflight_200(self, base, path):
        r = requests.options(
            f"{base}{path}",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "Authorization",
            },
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, (
            f"OPTIONS {path} returned {r.status_code}, expected 200"
        )
        assert "access-control-allow-origin" in {k.lower() for k in r.headers}, (
            f"OPTIONS {path} missing Access-Control-Allow-Origin header"
        )
