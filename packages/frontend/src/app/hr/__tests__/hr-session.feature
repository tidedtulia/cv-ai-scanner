Feature: The HR area needs a session (hr-auth AC-11 → AC-13)

  Scenario Outline: A cookie that is no longer valid sends me to the sign-in page (AC-11)
    Given my session cookie is <state>
    When I open the HR page "/hr/applications?status=EVALUATED"
    Then I am redirected to "<login>"

    Examples:
      | state                     | login                                                                    |
      | expired                   | /hr/login?next=%2Fhr%2Fapplications%3Fstatus%3DEVALUATED&reason=expired  |
      | for a deactivated account | /hr/login?next=%2Fhr%2Fapplications%3Fstatus%3DEVALUATED                 |

  Scenario: The HR home page (AC-12)
    Given my browser prefers Vietnamese
    And I am signed in as "Lan Nguyen"
    When I open the HR page "/hr"
    Then the header shows "CV AI Scanner" with the badge "HR"
    And the header shows "Đang đăng nhập: Lan Nguyen", a "Đăng xuất" button and the language switch
    And the public navigation and footer are not shown
    And I see the heading "Xin chào, Lan Nguyen"
    And the tab title is "HR · CV AI Scanner"
    And search engines are told not to index the HR area

  Scenario: Sign out (AC-12)
    Given I am signed in as "Lan Nguyen"
    When I open the HR page "/hr"
    And I click "Sign out"
    Then the sign-out API is called
    And I am sent to "/hr/login"

  Scenario: The backend cannot be reached (AC-12)
    Given I am signed in as "Lan Nguyen"
    But the backend is down
    When I open the HR page "/hr"
    Then I see the alert "We could not check your session right now. Please try again in a moment."
    And no "Sign out" button is shown

  Scenario: The session expires while I am working (AC-13)
    Given I am on "/hr/applications?page=2"
    When a request to the HR API answers 401
    Then I am sent to "/hr/login?next=%2Fhr%2Fapplications%3Fpage%3D2&reason=expired"
    And the page does not get the response

  Scenario: Other HR API answers are passed to the page (AC-13)
    Given I am on "/hr"
    When a request to the HR API answers 200
    Then the page gets the response
    And I stay on the page
