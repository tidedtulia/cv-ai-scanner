Feature: Home page and site layout
  As a candidate
  I want to understand what the site is for and find my way around
  So that I know how to apply

  # AC-1
  Scenario: Introduce the project
    Given my browser prefers Vietnamese
    When I open the home page
    Then I see the main heading "Tìm công việc phù hợp và ứng tuyển chỉ trong vài phút"
    And I see a "Xem việc làm đang tuyển" link to "/jobs"
    And I see the steps "Chọn công việc, Nộp CV, HR xem xét"
    And the steps mention "tối đa 10MB"
    And the steps mention "Quyết định cuối cùng luôn do con người đưa ra"

  # AC-2
  Scenario: Show the header and footer on every page
    Given my browser prefers Vietnamese
    When I open a public page
    Then the header has the links "CV AI Scanner → /, Trang chủ → /, Việc làm → /jobs"
    And the header has the language buttons "VI, EN"
    And the footer has a "Chính sách quyền riêng tư" link to "/privacy"
    And the footer says "CV được AI hỗ trợ sàng lọc. Quyết định tuyển dụng luôn do bộ phận HR đưa ra."
