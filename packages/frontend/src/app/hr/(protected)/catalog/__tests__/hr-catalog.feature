Feature: Job categories and levels (hr-positions AC-17)

  Scenario: Both tables (AC-17)
    Given my browser prefers Vietnamese
    And the catalog has the categories "Developer (2 jobs), QA (0 jobs, hidden)" and the levels "Intern (1 job), Senior (3 jobs)"
    When I open the catalog page
    Then I see the tables "Nhóm vị trí" and "Level"
    And the table "Nhóm vị trí" has the columns "Tên, Mã, Thứ tự, Job, Trạng thái, Thao tác"
    And the row "Developer" in "Nhóm vị trí" shows "DEVELOPER", "2" and "Đang hiện"
    And the row "QA" in "Nhóm vị trí" shows "Đã ẩn" and is dimmed
    And I see "Thứ tự là thứ bậc: số nhỏ = level thấp."

  Scenario: Adding a category (AC-17)
    Given the catalog has the categories "Developer (2 jobs)" and the levels "Intern (1 job)"
    When I open the catalog page
    And I click "Add a category"
    Then the dialog "Add a category" opens with an empty name, code and order
    When I save the catalog form without a name
    Then the dialog shows the alert "Name is required"
    And no request is sent
    When I fill in the name "Data & AI" and the order "35"
    And I save the catalog form
    Then "POST /api/hr/job-categories" is sent with the name "Data & AI", the order 35 and no code
    And the dialog is closed and the page is refreshed
    And I see the status "Saved."

  Scenario: Adding a level with a code of my own (AC-17)
    Given the catalog has the categories "Developer (2 jobs)" and the levels "Intern (1 job)"
    When I open the catalog page
    And I click "Add a level"
    And I fill in the name "Lead" and the code "LEAD_2"
    And I save the catalog form
    Then "POST /api/hr/job-levels" is sent with the name "Lead", the code "LEAD_2" and no order

  Scenario Outline: Errors of the server (AC-17)
    Given the catalog has the categories "Developer (2 jobs)" and the levels "Intern (1 job)"
    And the server answers <status> <code>
    When I open the catalog page
    And I click "Add a category"
    And I fill in the name "QA" and the order ""
    And I save the catalog form
    Then the dialog shows the alert "<message>"
    And the page is not refreshed

    Examples:
      | status | code        | message                              |
      | 409    | NAME_TAKEN  | This name is already used            |
      | 409    | CODE_TAKEN  | This code is already used            |
      | 400    | CODE_INVALID| The code format is invalid           |
      | 500    | none        | Could not save. Please try again.    |

  Scenario: Renaming and reordering (AC-17)
    Given the catalog has the categories "Developer (2 jobs)" and the levels "Intern (1 job)"
    When I open the catalog page
    And I click "Edit: Intern"
    Then the dialog 'Edit "Intern"' opens with the name "Intern" and the order "10" and no code field
    When I fill in the name "Trainee" and the order "15"
    And I save the catalog form
    Then "PATCH /api/hr/job-levels/i0" is sent with the name "Trainee" and the order 15
    And the dialog is closed and the page is refreshed

  Scenario: Hiding a category in use asks first (AC-17)
    Given my browser prefers Vietnamese
    And the catalog has the categories "Developer (2 jobs)" and the levels "Intern (1 job)"
    When I open the catalog page
    And I click "Ẩn: Developer"
    Then the dialog 'Ẩn "Developer"?' says "2 job đang dùng vẫn giữ nguyên. Không chọn được cho job mới và không còn là bộ lọc của ứng viên."
    When I click "Huỷ"
    Then the dialog is closed and no request is sent
    When I click "Ẩn: Developer"
    And I click "Ẩn" in the dialog
    Then "PATCH /api/hr/job-categories/i0" is sent with isActive false
    And the dialog is closed and the page is refreshed

  Scenario: Showing a hidden level again needs no question (AC-17)
    Given the catalog has the categories "Developer (2 jobs)" and the levels "Intern (1 job, hidden)"
    When I open the catalog page
    And I click "Show: Intern"
    Then "PATCH /api/hr/job-levels/i0" is sent with isActive true
    And the page is refreshed

  Scenario: The backend fails (AC-17)
    When the HR API fails for the catalog
    Then I see the alert "We could not load the catalog right now. Please try again in a moment."
