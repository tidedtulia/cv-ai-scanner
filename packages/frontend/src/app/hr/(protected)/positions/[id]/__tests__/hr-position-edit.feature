Feature: Edit a job, its criteria, open / close / delete (hr-positions AC-14 → AC-16, AC-18)

  Scenario: Hints of a draft with applications (AC-14)
    Given my browser prefers Vietnamese
    And the job is "DRAFT" with 2 applications
    When I open the job page
    Then I see "Job đang ở dạng nháp. Hãy thêm ít nhất 1 tiêu chí rồi mở job."
    And I see "Job này đã có 2 đơn: kết quả đã chấm giữ nguyên, đơn chưa chấm sẽ dùng nội dung mới."

  Scenario: The form shows the job; the code cannot be changed (AC-14)
    Given the job uses the hidden category "Old Category"
    When I open the job page
    Then the field "Title" is "Backend Developer"
    And the field "Minimum years of experience" is "2"
    And the field "Level" is "MIDDLE"
    And the category list shows "Old Category (hidden)" as chosen
    And I see the code "backend-dev" and the link "/submit-cv?position=backend-dev"
    And there is no field "Code (optional)"

  Scenario: Saving the changes (AC-14)
    When I open the job page
    And I change "Title" to "Senior Backend Developer"
    And I press "Save"
    Then "PATCH /api/hr/positions/5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01" is sent with the title "Senior Backend Developer" and no code
    And I see the status "Saved."
    And the page is refreshed

  Scenario: Errors keep what I typed (AC-14)
    Given the server answers 400 DESCRIPTION_REQUIRED
    When I open the job page
    And I change "Title" to "Another title"
    And I press "Save"
    Then I see the alert "The job description is required"
    And the field "Title" is "Another title"

  Scenario: The criteria table (AC-15)
    Given my browser prefers Vietnamese
    When I open the job page
    Then the criteria table has the columns "Tiêu chí, Loại, Trọng số, Hướng dẫn chấm, Thao tác"
    And the criterion "NestJS" shows "Kỹ thuật", "5" and "≥ 2 years in production" with the badge "Bắt buộc"
    And the criterion "PostgreSQL" has no badge
    And the criteria are listed in the order "NestJS, PostgreSQL, English"
    And "Lên" is disabled for "NestJS" and "Xuống" is disabled for "English"
    And I see "Ứng viên thấy tên và loại; trọng số, "Bắt buộc" và hướng dẫn chấm chỉ nội bộ."

  Scenario: A job without criteria (AC-15)
    Given the job has no criteria
    When I open the job page
    Then I see "No criterion yet. Add at least 1 before opening the job."

  Scenario: Moving a criterion (AC-15)
    When I open the job page
    And I click "Move up: PostgreSQL"
    Then "POST /api/hr/positions/5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01/criteria/c2/move" is sent with direction "up"
    And the page is refreshed

  Scenario: Adding a criterion (AC-15)
    When I open the job page
    And I click "Add criterion"
    Then the dialog "Add a criterion" opens with weight "3" and the criterion not required
    When I save the criterion without a name
    Then the dialog shows the alert "Name is required"
    And no request is sent
    When I fill in the criterion "Docker", type "Technical", weight "4", required and guide "Compose, images"
    And I save the criterion
    Then "POST /api/hr/positions/5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01/criteria" is sent with name "Docker", type "TECHNICAL", weight 4, required and guide "Compose, images"
    And the dialog is closed and the page is refreshed

  Scenario Outline: The weight must be 1 to 5 (AC-15)
    When I open the job page
    And I click "Add criterion"
    And I fill in the criterion "Docker", type "Technical", weight "<weight>", not required and guide ""
    And I save the criterion
    Then <outcome>

    Examples:
      | weight | outcome                                                                                |
      | 0      | the dialog shows the alert "Weight must be a whole number from 1 to 5"                 |
      | 6      | the dialog shows the alert "Weight must be a whole number from 1 to 5"                 |
      | 2.5    | the dialog shows the alert "Weight must be a whole number from 1 to 5"                 |
      | 1      | the request has weight 1 and no guide                                                  |
      | 5      | the request has weight 5 and no guide                                                  |

  Scenario: Editing a criterion (AC-15)
    When I open the job page
    And I click "Edit: PostgreSQL"
    Then the dialog "Edit the criterion" opens with name "PostgreSQL" and weight "4"
    When I change the criterion weight to "2"
    And I save the criterion
    Then "PATCH /api/hr/positions/5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01/criteria/c2" is sent with weight 2
    And the dialog is closed and the page is refreshed

  Scenario: Deleting a criterion asks first (AC-15)
    When I open the job page
    And I click "Delete: English"
    Then the dialog 'Delete the criterion "English"?' opens
    When I click "Cancel"
    Then the dialog is closed and no request is sent
    When I click "Delete: English"
    And I click "Delete" in the dialog
    Then "DELETE /api/hr/positions/5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01/criteria/c3" is sent
    And the dialog is closed and the page is refreshed

  Scenario: The last criterion of an open job stays (AC-15)
    Given the server answers 409 LAST_CRITERION
    When I open the job page
    And I click "Delete: English"
    And I click "Delete" in the dialog
    Then the dialog shows the alert "Close the job before deleting its last criterion"

  Scenario: A warning when the job has applications (AC-15)
    Given my browser prefers Vietnamese
    When I open the job page
    Then I see "Job này đã có 4 đơn: kết quả đã chấm giữ nguyên, đơn chưa chấm sẽ dùng tiêu chí mới."

  Scenario Outline: Buttons of each status (AC-16)
    Given the job is "<status>" with 4 applications
    When I open the job page
    Then I see the status buttons "<buttons>"

    Examples:
      | status | buttons                  |
      | DRAFT  | Open job                 |
      | OPEN   | Close job, Back to draft |
      | CLOSED | Reopen                   |

  Scenario: Opening a job needs a confirmation (AC-16)
    Given the job is "DRAFT" with 0 applications
    When I open the job page
    And I click "Open job"
    Then the dialog "Open job" says "The job will be shown to candidates and accept applications."
    When I click "Confirm"
    Then "POST /api/hr/positions/5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01/status" is sent with status "OPEN"
    And the dialog is closed and the page is refreshed
    And I see the status "Saved."

  Scenario: Opening a job without criteria is refused (AC-16)
    Given the job is "DRAFT" with 0 applications
    And the server answers 409 CRITERIA_REQUIRED
    When I open the job page
    And I click "Open job"
    And I click "Confirm"
    Then the dialog shows the alert "Add at least 1 criterion before opening the job"
    And the page is not refreshed

  Scenario: Closing a job (AC-16)
    When I open the job page
    And I click "Close job"
    Then the dialog "Close job" says "The job will no longer be shown or accept applications. Existing applications are kept."

  Scenario: Deleting a job without applications (AC-16)
    Given the job is "DRAFT" with 0 applications
    When I open the job page
    And I click "Delete job"
    Then the dialog 'Delete the job "Backend Developer"?' says "This also deletes its criteria and cannot be undone."
    When I click "Delete job" in the dialog
    Then "DELETE /api/hr/positions/5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01" is sent
    And I am sent to "/hr/positions"

  Scenario: A job with applications cannot be deleted (AC-16)
    When I open the job page
    Then there is no button "Delete job"
    And I see "This job already has 4 applications, so it cannot be deleted. Close it instead."
    And I see the link "View the 4 applications" to "/hr?tab=all&position=backend-dev"

  Scenario Outline: Unknown job (AC-18)
    When the HR API answers <status> for the job
    Then I see "Job not found."
    And I see the link "← Jobs" to "/hr/positions"

    Examples:
      | status |
      | 404    |
      | 400    |

  Scenario: The backend fails (AC-18)
    When the HR API answers 500 for the job
    Then I see the alert "We could not load the jobs right now. Please try again in a moment."
