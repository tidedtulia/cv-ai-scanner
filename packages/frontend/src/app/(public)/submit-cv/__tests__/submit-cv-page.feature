Feature: Submit CV page
  As a candidate coming from the jobs page
  I want the job I picked to be selected already
  So that I only fill in my details

  # AC-7
  Scenario Outline: Preselect the job chosen on the jobs page
    Given my browser prefers English
    And the API has the open jobs "Frontend Developer, Backend Developer"
    When I open the submit CV page with "position=<code>"
    Then the position "Backend Developer" is selected
    And I see the criteria "NestJS, PostgreSQL, Prisma ORM"

    Examples:
      | code        |
      | backend-dev |
      | BACKEND-DEV |

  # AC-7
  Scenario: An unknown or closed job is not preselected
    Given my browser prefers English
    And the API has the open jobs "Frontend Developer, Backend Developer"
    When I open the submit CV page with "position=closed-job"
    Then no position is selected
    And the position list has "Frontend Developer, Backend Developer"

  # AC-8
  Scenario: No open jobs to apply for
    Given my browser prefers English
    And the API has no open jobs
    When I open the submit CV page
    Then I see the message "There are no open jobs to apply for right now."
    And I see a "View open jobs" link to "/jobs"
    And I do not see the form

  # AC-8
  Scenario: The backend is unavailable
    Given my browser prefers English
    And the backend is unavailable
    When I open the submit CV page
    Then I see the alert "We could not load the data right now. Please try again in a moment."
    And I do not see the form
