Feature: HR sign-in page (hr-auth AC-9 → AC-11)

  Scenario: The sign-in form (AC-9)
    Given my browser prefers Vietnamese
    When I open "/hr/login"
    Then the tab title is "Đăng nhập HR · CV AI Scanner"
    And I see the heading "Đăng nhập khu vực HR"
    And I see the fields "Email, Mật khẩu" and the button "Đăng nhập"
    And the password field hides what I type
    And the HR header shows the language switch but no "Đăng xuất" button

  Scenario: The form is checked in the browser before calling the API (AC-9)
    When I open "/hr/login"
    And I click "Sign in"
    Then I see "Please enter your email" under "Email"
    And I see "Please enter your password" under "Password"
    And no sign-in request is sent
    When I type "not-an-email" in "Email"
    And I type "anything" in "Password"
    And I click "Sign in"
    Then I see "Invalid email address" under "Email"
    And no sign-in request is sent

  Scenario: The button is disabled while signing in (AC-9)
    Given the API answers slowly
    When I open "/hr/login"
    And I sign in with "hr@example.com" and "Correct-horse-1"
    Then the button shows "Signing in…" and is disabled

  Scenario Outline: Where I go after signing in (AC-10)
    When I open "<page>"
    And I sign in with " HR@Example.com " and "Correct-horse-1"
    Then the API receives the email "HR@Example.com" and the password as JSON
    And I am sent to "<target>"

    Examples:
      | page                                                          | target                            |
      | /hr/login?next=%2Fhr%2Fapplications%3Fstatus%3DEVALUATED      | /hr/applications?status=EVALUATED |
      | /hr/login                                                     | /hr                               |
      | /hr/login?next=%2F%2Fevil.example                             | /hr                               |
      | /hr/login?next=https%3A%2F%2Fevil.example%2Fhr                | /hr                               |
      | /hr/login?next=%2Fjobs                                        | /hr                               |
      | /hr/login?next=%2Fhr%2Flogin                                  | /hr                               |

  Scenario Outline: Sign-in errors keep the email and clear the password (AC-10)
    Given my browser prefers Vietnamese
    And the API answers <answer>
    When I open "/hr/login"
    And I sign in with "hr@example.com" and "wrong-password"
    Then I see the message "<message>"
    And the email field still contains "hr@example.com" and the password field is empty
    And I stay on the sign-in page

    Examples:
      | answer                          | message                                                    |
      | 401 INVALID_CREDENTIALS         | Email hoặc mật khẩu không đúng.                            |
      | 429 with Retry-After 840        | Bạn đã nhập sai quá nhiều lần. Thử lại sau 14 phút.        |
      | 429 with Retry-After 30         | Bạn đã nhập sai quá nhiều lần. Thử lại sau 1 phút.         |
      | 500                             | Không kết nối được máy chủ. Vui lòng thử lại.              |
      | a network error                 | Không kết nối được máy chủ. Vui lòng thử lại.              |

  Scenario: The page says when a session expired (AC-11)
    When I open "/hr/login?reason=expired&next=%2Fhr"
    Then I see the status "Your session has expired. Please sign in again."

  Scenario: An expired cookie still shows the form (AC-11)
    Given my session cookie is expired
    When I open "/hr/login"
    Then I see the heading "Sign in to the HR area"

  Scenario: Already signed in (AC-11)
    Given I am signed in as "HR Admin"
    When I open "/hr/login?next=%2Fhr%2Fapplications"
    Then I am redirected to "/hr/applications"
