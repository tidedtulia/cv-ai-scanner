Feature: Decide or re-evaluate an application (hr-applications AC-16, AC-17)

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
    And it has an empty note box "Ghi chú (không bắt buộc, chỉ HR thấy)" limited to 2000 characters
    And the focus is in the dialog

    Examples:
      | button  | title                                                  |
      | Nhận    | Nhận ứng viên Nguyễn Văn An cho vị trí Backend Developer? |
      | Từ chối | Từ chối ứng viên Nguyễn Văn An cho vị trí Backend Developer? |

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
    And no request was sent
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
    And I see the status "Decision saved."

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
