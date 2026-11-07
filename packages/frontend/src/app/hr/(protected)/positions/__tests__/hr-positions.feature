Feature: HR list and creation of jobs (hr-positions AC-13, AC-14)

  Scenario: Table of jobs (AC-13)
    Given my browser prefers Vietnamese
    And there are the jobs "Backend Developer" (open, 3 criteria, 4 applications) and "Old Job" (closed)
    When I open the jobs page ""
    Then the table has the columns "Job, Mã, Nhóm · level, Trạng thái, Tiêu chí, Đơn, Cập nhật"
    And the row "Backend Developer" shows "backend-dev", "Developer · Middle", "Đang mở", "3", "4" and "07/11/2026"
    And "Backend Developer" links to "/hr/positions/5d0c9a3e-1b2c-4d3e-8f4a-5b6c7d8e9f01"
    And the number of applications of "Backend Developer" links to "/hr?tab=all&position=backend-dev"
    And I see the link "Tạo job" to "/hr/positions/new"

  Scenario: Filter by status with links and counts (AC-13)
    Given my browser prefers Vietnamese
    And there are the jobs "Backend Developer" (open, 3 criteria, 4 applications) and "Old Job" (closed)
    When I open the jobs page "?status=CLOSED"
    Then the status links are "Tất cả 2 → /hr/positions, Nháp 0 → /hr/positions?status=DRAFT, Đang mở 1 → /hr/positions?status=OPEN, Đã đóng 1 → /hr/positions?status=CLOSED"
    And the current status link is "Đã đóng"
    And only the job "Old Job" is listed

  Scenario: No jobs yet (AC-13)
    Given my browser prefers Vietnamese
    And there are no jobs
    When I open the jobs page ""
    Then I see "Chưa có job nào."
    And I see the link "Tạo job" to "/hr/positions/new"

  Scenario: The backend fails (AC-13)
    Given the HR API is down
    When I open the jobs page ""
    Then I see the alert "We could not load the jobs right now. Please try again in a moment."

  Scenario: The create form (AC-14)
    Given my browser prefers Vietnamese
    And the catalog has the categories "Developer, QA (hidden)" and the levels "Intern, Middle"
    When I open the new job page
    Then I see the fields "Tiêu đề, Nhóm, Level, Số năm kinh nghiệm tối thiểu, Mô tả công việc (markdown), Mã (không bắt buộc)"
    And the category list offers "Developer" but not "QA"
    And the level list offers "Intern" and "Middle"

  Scenario: The code hint follows the title (AC-14)
    Given the catalog has the categories "Developer" and the levels "Middle"
    When I open the new job page
    And I type "Lập trình viên Backend" in "Title"
    Then I see the hint 'Left empty: "lap-trinh-vien-backend".'

  Scenario: The form is checked in the browser (AC-14)
    Given the catalog has the categories "Developer" and the levels "Middle"
    When I open the new job page
    And I press "Create job"
    Then I see under "Title" "Title is required"
    And I see under "Category" "Choose a category that is shown"
    And I see under "Level" "Choose a level that is shown"
    And I see under "Job description (markdown)" "The job description is required"
    And no request is sent

  Scenario Outline: Years of experience (AC-14)
    Given the catalog has the categories "Developer" and the levels "Middle"
    When I open the new job page
    And I fill in a valid job with "<years>" years
    And I press "Create job"
    Then <outcome>

    Examples:
      | years | outcome                                                                       |
      | -1    | I see under "Minimum years of experience" "Years of experience must be a whole number from 0 to 50" |
      | 51    | I see under "Minimum years of experience" "Years of experience must be a whole number from 0 to 50" |
      | 1.5   | I see under "Minimum years of experience" "Years of experience must be a whole number from 0 to 50" |
      | 0     | the job is sent with 0 years                                                  |
      | 50    | the job is sent with 50 years                                                 |

  Scenario: Creating a job goes to its page (AC-14)
    Given the catalog has the categories "Developer" and the levels "Middle"
    And the server creates the job with id "new-id"
    When I open the new job page
    And I fill in a valid job with "3" years
    And I press "Create job"
    Then "POST /api/hr/positions" is sent as JSON with the title "Backend Developer", category "DEVELOPER", level "MIDDLE", 3 years and no code
    And I am sent to "/hr/positions/new-id"

  Scenario: A code typed by hand is sent (AC-14)
    Given the catalog has the categories "Developer" and the levels "Middle"
    When I open the new job page
    And I fill in a valid job with "3" years
    And I type "senior-java" in "Code (optional)"
    And I press "Create job"
    Then the request has the code "senior-java"

  Scenario Outline: Errors of the server (AC-14)
    Given the catalog has the categories "Developer" and the levels "Middle"
    And the server answers <status> <code>
    When I open the new job page
    And I fill in a valid job with "3" years
    And I press "Create job"
    Then <where>
    And I stay on the form

    Examples:
      | status | code           | where                                                              |
      | 409    | CODE_TAKEN     | I see under "Code (optional)" "This code is already used"          |
      | 400    | CODE_INVALID   | I see under "Code (optional)" "The code format is invalid"         |
      | 400    | LEVEL_INVALID  | I see the alert "Choose a level that is shown"                      |
      | 500    | none           | I see the alert "Could not save. Please try again."                 |
