Feature: Menu of the HR area (hr-positions AC-12)

  Scenario Outline: The menu marks the current page
    Given my browser prefers Vietnamese
    And I am signed in as "Lan Nguyen"
    When I open the HR header on "<path>"
    Then the menu "Menu HR" has the links "Đơn ứng tuyển → /hr, Job → /hr/positions, Danh mục → /hr/catalog"
    And the current page is "<current>"

    Examples:
      | path                       | current        |
      | /hr                        | Đơn ứng tuyển  |
      | /hr/applications/a1        | Đơn ứng tuyển  |
      | /hr/positions              | Job            |
      | /hr/positions/new          | Job            |
      | /hr/positions/5d0c9a3e     | Job            |
      | /hr/catalog                | Danh mục       |

  Scenario: The menu is in English too
    Given I am signed in as "Lan Nguyen"
    When I open the HR header on "/hr/catalog"
    Then the menu "HR menu" has the links "Applications → /hr, Jobs → /hr/positions, Catalog → /hr/catalog"

  Scenario: No menu before signing in
    When I open the HR header without a session on "/hr/login"
    Then I see no menu
