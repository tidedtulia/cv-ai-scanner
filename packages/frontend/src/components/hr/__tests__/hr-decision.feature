Feature: Decide or re-evaluate an application (hr-applications AC-16, AC-17; result-email AC-9, AC-10)

  Scenario Outline: Which buttons are shown (AC-16, AC-17)
    Given I can decide "<decide>" and re-evaluate "<reEvaluate>"
    When I open the application actions
    Then I see the buttons "<buttons>"

    Examples:
      | decide | reEvaluate | buttons                         |
      | yes    | yes        | Accept, Reject, Re-evaluate     |
      | no     | no         |                                 |

  Scenario Outline: The confirmation dialog (AC-16)
    Given my browser prefers Vietnamese
    When I open the application actions
    And I click "<button>"
    Then the dialog is titled "<title>"
    And it says "Quyết định này không sửa được."
    And it has an empty note box "Ghi chú (không bắt buộc, chỉ HR thấy, không gửi trong email)" limited to 2000 characters
    And the focus is in the dialog

    Examples:
      | button  | title                                                  |
      | Nhận    | Nhận ứng viên Nguyễn Văn An cho vị trí Backend Developer? |
      | Từ chối | Từ chối ứng viên Nguyễn Văn An cho vị trí Backend Developer? |

  Scenario Outline: The dialog shows the email that will be sent (result-email AC-9)
    Given my browser prefers Vietnamese
    When I open the application actions
    And I click "<button>"
    Then the API is asked for the preview "<url>"
    And the dialog shows the email preview in "Tiếng Việt" to "an@example.com" with subject "Kết quả ứng tuyển: Backend Developer"
    And the preview says "<sentence>"
    And it says "Xác nhận sẽ lưu quyết định và gửi email này tới an@example.com."
    And it says "Quyết định này không sửa được."

    Examples:
      | button  | url                                                 | sentence                    |
      | Nhận    | /api/hr/applications/a1/email-preview?decision=ACCEPTED | vui mừng thông báo          |
      | Từ chối | /api/hr/applications/a1/email-preview?decision=REJECTED | chưa thể tiếp tục           |

  Scenario: The preview names the language of the candidate (result-email AC-9)
    Given the candidate applied in English
    When I open the application actions
    And I click "Accept"
    Then the dialog shows the email preview in "English" to "an@example.com" with subject "Your application: Backend Developer"

  Scenario Outline: A slow or failed preview does not block the decision (result-email AC-9)
    Given the preview <state>
    When I open the application actions
    And I click "Accept"
    Then I see "<text>"
    And the confirm button is enabled
    When I click "Confirm"
    Then "POST /api/hr/applications/a1/decision" is sent as JSON with decision "ACCEPTED" and note ""

    Examples:
      | state             | text                           |
      | is still loading  | Loading the preview…           |
      | cannot be loaded  | The preview could not be loaded. |

  Scenario: Re-evaluate has no email preview (result-email AC-9)
    When I open the application actions
    And I click "Re-evaluate"
    Then there is no email preview
    And the API was not asked for a preview

  Scenario Outline: What I am told after confirming (result-email AC-10)
    Given the server saves the decision and says the email was sent "<sent>"
    When I open the application actions
    And I click "Accept"
    And I click "Confirm"
    Then I see the status "<text>"
    And the status is shown as a <tone>

    Examples:
      | sent  | text                                                                  | tone    |
      | true  | Decision saved and the email sent to the candidate.                   | success |
      | false | Decision saved, but the email could not be sent. You can press Resend. | warning |

  Scenario: The note counts characters (AC-16)
    When I open the application actions
    And I click "Accept"
    And I type the note "Great fit"
    Then I see "9/2000"

  Scenario Outline: Cancel does nothing (AC-16)
    When I open the application actions
    And I click "Reject"
    And I <close>
    Then the dialog is closed
    And no change request was sent
    And the focus is back on "Reject"

    Examples:
      | close            |
      | click Cancel     |
      | press Escape     |

  Scenario: Confirming a decision (AC-16)
    When I open the application actions
    And I click "Accept"
    And I type the note "  Great fit  "
    And I click "Confirm"
    Then "POST /api/hr/applications/a1/decision" is sent as JSON with decision "ACCEPTED" and note "  Great fit  "
    And the dialog is closed and the page is refreshed
    And I see the status "Decision saved and the email sent to the candidate."

  Scenario: The button is locked while saving (AC-16)
    Given the server is slow
    When I open the application actions
    And I click "Reject"
    And I click "Confirm"
    Then the confirm button shows "Saving…" and is disabled
    And Cancel is disabled

  Scenario: Somebody else was faster (AC-16)
    Given the server answers 409
    When I open the application actions
    And I click "Accept"
    And I click "Confirm"
    Then I see the status "This application was just updated by someone else."
    And the dialog is closed and the page is refreshed

  Scenario Outline: A failure keeps what I typed (AC-16)
    Given the server <failure>
    When I open the application actions
    And I click "Accept"
    And I type the note "Keep me"
    And I click "Confirm"
    Then the dialog shows the alert "Could not save. Please try again."
    And the note still contains "Keep me"
    And the page is not refreshed

    Examples:
      | failure           |
      | answers 500       |
      | cannot be reached |

  Scenario: Re-evaluate (AC-17)
    When I open the application actions
    And I click "Re-evaluate"
    Then the dialog is titled "Re-evaluate this application?"
    And it says "The AI will evaluate this application again in the next 00:00 run. The current result is kept until the new one is ready."
    When I click "Confirm"
    Then "POST /api/hr/applications/a1/re-evaluate" is sent as JSON with an empty body
    And I see the status "Re-evaluation requested."
    And the page is refreshed

  Scenario: The session expired while the dialog was open (AC-13, AC-17)
    Given the server answers 401
    When I open the application actions
    And I click "Re-evaluate"
    And I click "Confirm"
    Then I am sent to the sign-in page
    And no error is shown in the dialog
