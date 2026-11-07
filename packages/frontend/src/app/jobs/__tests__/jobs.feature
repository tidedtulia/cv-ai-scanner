Feature: Open jobs page
  As a candidate
  I want to browse the jobs that are open
  So that I can pick one to apply for

  # AC-3
  Scenario: List the open jobs in the order of the API
    Given my browser prefers English
    And the API has the open jobs "QA Intern, Backend Developer, Frontend Developer"
    When I open the jobs page
    Then I see the job cards "QA Intern, Backend Developer, Frontend Developer" in that order
    And the "Backend Developer" card shows "Developer · Middle · 3+ years of experience"
    And the "Backend Developer" card has the tags "NestJS, PostgreSQL, Prisma ORM"
    And the "Backend Developer" card has an "Apply" link to "/submit-cv?position=backend-dev"

  # AC-3
  Scenario: A job that needs no experience
    Given my browser prefers English
    And the API has the open jobs "QA Intern"
    When I open the jobs page
    Then the "QA Intern" card shows "QA / Tester · Intern · No experience required"

  # AC-4
  Scenario: Choosing a level puts it in the URL
    Given my browser prefers English
    And the API has the open jobs "Backend Developer, Frontend Developer"
    When I open the jobs page with "category=DEVELOPER"
    And I choose "Middle" in the "Level" filter
    Then the URL becomes "/jobs?category=DEVELOPER&level=MIDDLE"

  # AC-4
  Scenario: Choosing "All" removes that filter from the URL
    Given my browser prefers English
    And the API has the open jobs "Backend Developer"
    When I open the jobs page with "category=DEVELOPER&level=MIDDLE"
    And I choose "All categories" in the "Category" filter
    Then the URL becomes "/jobs?level=MIDDLE"

  # AC-4
  Scenario: Open a filtered URL directly
    Given my browser prefers English
    And the API has the open jobs "Backend Developer"
    When I open the jobs page with "category=developer"
    Then the API was asked for the jobs of category "developer" and level ""
    And the "Category" filter shows "Developer"
    And I see a "Clear filters" link to "/jobs"

  # AC-4
  Scenario: No "Clear filters" link without filters
    Given my browser prefers English
    And the API has the open jobs "Backend Developer"
    When I open the jobs page
    Then I do not see a "Clear filters" link

  # AC-5
  Scenario: No job matches the filters
    Given my browser prefers English
    And the API has no open jobs
    When I open the jobs page with "level=SENIOR"
    Then I see the message "No open jobs match these filters."
    And I see a "Clear filters" link to "/jobs"

  # AC-5
  Scenario: No open jobs at all
    Given my browser prefers English
    And the API has no open jobs
    When I open the jobs page
    Then I see the message "There are no open jobs right now. Please check back later."

  # AC-6
  Scenario: The backend is unavailable
    Given my browser prefers English
    And the backend is unavailable
    When I open the jobs page
    Then I see the main heading "Open jobs"
    And I see the alert "We could not load the data right now. Please try again in a moment."
    And I see no job card and no filter

  # AC-18
  Scenario: Labels are translated, job content is not
    Given my browser prefers Vietnamese
    And the API has the open jobs "QA Intern"
    When I open the jobs page
    Then the "QA Intern" card shows "QA / Tester · Intern · Không yêu cầu kinh nghiệm"
    And the "QA Intern" card has the tags "Manual testing, English"
    And the "QA Intern" card has an "Ứng tuyển" link to "/submit-cv?position=qa-intern"
