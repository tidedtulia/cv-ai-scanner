Feature: Result email of a decided application (result-email AC-11, AC-13)

  Scenario: The email was sent (AC-11)
    Given my browser prefers Vietnamese
    And the application was accepted and the email was sent at "2026-11-07T03:30:00.000Z"
    When I open the result email section
    Then I see the heading "Email kết quả"
    And I see "Đã gửi lúc 07/11/2026 10:30 (giờ Việt Nam)"
    And there is no "Gửi lại" button

  Scenario: The email was not sent (AC-11)
    Given my browser prefers Vietnamese
    And the application was rejected and the email is not sent
    When I open the result email section
    Then I see "Chưa gửi được email"
    And there is a "Gửi lại" button

  Scenario Outline: No section before a decision (AC-11)
    Given the application is "<status>"
    When I open the result email section
    Then there is no result email section

    Examples:
      | status            |
      | SUBMITTED         |
      | EVALUATED         |
      | EVALUATION_FAILED |

  Scenario: Resend asks for confirmation with the email preview (AC-11)
    Given the application was rejected and the email is not sent
    When I open the result email section
    And I click "Resend"
    Then the dialog is titled "Resend the result email to Nguyễn Văn An?"
    And it says "The email below will be sent to an@example.com."
    And the API is asked for the preview "/api/hr/applications/a1/email-preview?decision=REJECTED"
    And the focus is in the dialog

  Scenario Outline: Cancel does nothing (AC-11)
    Given the application was accepted and the email is not sent
    When I open the result email section
    And I click "Resend"
    And I <close>
    Then the dialog is closed
    And no change request was sent

    Examples:
      | close        |
      | click Cancel |
      | press Escape |

  Scenario: Resending successfully (AC-11)
    Given the application was accepted and the email is not sent
    When I open the result email section
    And I click "Resend"
    And I click "Send email"
    Then "POST /api/hr/applications/a1/resend-email" is sent as JSON with an empty body
    And the dialog is closed and the page is refreshed
    And I see the status "Email sent to the candidate."

  Scenario Outline: Resending fails (AC-11)
    Given the server <failure>
    And the application was accepted and the email is not sent
    When I open the result email section
    And I click "Resend"
    And I click "Send email"
    Then the dialog shows the alert "Could not send the email. Please try again."
    And the page is not refreshed
    And "Send email" can be pressed again

    Examples:
      | failure                            |
      | answers 502 EMAIL_SEND_FAILED      |
      | cannot be reached                  |

  Scenario: Somebody sent it already (AC-11)
    Given the server answers 409 EMAIL_ALREADY_SENT
    And the application was accepted and the email is not sent
    When I open the result email section
    And I click "Resend"
    And I click "Send email"
    Then I see the status "The email was already sent."
    And the dialog is closed and the page is refreshed

  Scenario: The session expired (AC-11)
    Given the server answers 401
    And the application was accepted and the email is not sent
    When I open the result email section
    And I click "Resend"
    And I click "Send email"
    Then I am sent to the sign-in page
    And no error is shown in the dialog
