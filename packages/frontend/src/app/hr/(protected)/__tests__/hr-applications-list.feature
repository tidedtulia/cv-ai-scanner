Feature: HR list of applications (hr-applications AC-9 → AC-12)

  Scenario: Tabs with the number of applications (AC-9)
    Given my browser prefers Vietnamese
    When I open the HR list "/hr"
    Then I see the tabs "Cần quyết định 5, Đang chờ chấm 3, Đã quyết định 2, Tất cả 10"
    And the tab "Cần quyết định" is the current one
    And the API is asked for "tab=to-decide"

  Scenario: Changing the tab goes back to page 1 and keeps the other filters (AC-9, AC-10)
    When I open the HR list "/hr?tab=all&position=backend-dev&q=nguyen&page=2"
    Then the tab "Decided 2" links to "/hr?tab=decided&position=backend-dev&q=nguyen"
    And the tab "To decide 5" links to "/hr?position=backend-dev&q=nguyen"
    And the API is asked for "tab=all&position=backend-dev&q=nguyen&page=2"

  Scenario: Each row (AC-11)
    Given my browser prefers Vietnamese
    And the list has an evaluated application and one not yet evaluated
    When I open the HR list "/hr?tab=all"
    Then the row of "Nguyễn Văn An" shows "an@example.com", "Backend Developer", "07/11/2026", "Đã chấm", "83.3" and "Nên nhận"
    And the row of "Lê Thị Bình" shows "Chờ chấm" and "—" instead of a score
    And "Nguyễn Văn An" links to "/hr/applications/a1?from=tab%3Dall"

  Scenario: Decided applications whose email is not sent are marked (result-email AC-12)
    Given my browser prefers Vietnamese
    And the list has a decided application without email and one with its email sent
    When I open the HR list "/hr?tab=decided"
    Then the row of "Nguyễn Văn An" shows "Đã nhận" and "Chưa gửi email"
    And the row of "Lê Thị Bình" shows "Đã từ chối" but not "Chưa gửi email"

  Scenario: Filters, search and sort are in the form and in the URL (AC-10)
    Given my browser prefers Vietnamese
    When I open the HR list "/hr?tab=all&position=old-job&recommendation=CONSIDER&q=lan&sort=score"
    Then the filter "Vị trí" is "old-job" and offers "Old Job (đã đóng)"
    And the filter "Khuyến nghị" is "CONSIDER"
    And the filter "Sắp xếp" is "score"
    And the search box contains "lan"
    And I see the link "Bỏ lọc" to "/hr?tab=all&sort=score"

  Scenario: No clear-filters link without filters (AC-10)
    When I open the HR list "/hr?tab=all"
    Then I see no link "Clear filters"

  Scenario Outline: Empty states (AC-12)
    Given my browser prefers Vietnamese
    And the list is empty
    When I open the HR list "<url>"
    Then I see the message "<message>"

    Examples:
      | url          | message                          |
      | /hr          | Chưa có đơn nào trong mục này.   |
      | /hr?q=nobody | Không có đơn nào khớp bộ lọc.    |

  Scenario: The backend fails (AC-12)
    Given the HR API is down
    When I open the HR list "/hr"
    Then I see the alert "We could not load the applications right now. Please try again in a moment."

  Scenario: The session expired (AC-12)
    Given the HR API answers 401 for an expired session
    When I open the HR list "/hr?tab=all&page=2"
    Then I am sent to the sign-in page

  Scenario: Pages (AC-10)
    Given there are 45 applications
    When I open the HR list "/hr?tab=all&page=2"
    Then I see "Page 2 of 3"
    And the link "Previous" goes to "/hr?tab=all"
    And the link "Next" goes to "/hr?tab=all&page=3"
