Feature: Submit CV form
  As a candidate
  I want to submit my CV for a position
  So that the company can review my application

  # AC-9
  Scenario: Show the submit CV form
    Given I am on the Submit CV page
    Then I see the "Name" field
    And I see the "Email" field
    And I see the "Position" field
    And I see the "Upload CV" field
    And I see the "I agree" field
    And the upload hint says "PDF only, max 10MB"
    And the "privacy policy" link opens "/privacy" in a new tab

  # AC-10
  Scenario: Show the job description of the selected position
    Given I am on the Submit CV page
    When I select the position "Backend Developer"
    Then I see the job summary "Developer · Middle · 3+ years of experience"
    And I see the job description containing "Design and build the APIs"
    And I see the criteria "NestJS, PostgreSQL, Prisma ORM"

  # AC-10
  Scenario: The job description cannot be loaded
    Given I am on the Submit CV page
    And the job description API is unavailable
    When I select the position "Backend Developer"
    Then I see the text "Could not load the job description."

  # AC-12
  Scenario: Submit CV successfully
    Given I am on the Submit CV page
    And the submit CV API responds successfully
    When I fill in all fields with a valid CV "cv.pdf"
    And I click the "Submit CV" button
    Then I see the message "Submit CV successfully"
    And the API received the form fields and the consent
    And I see a "Back to home" link to "/"
    And I see a "View other jobs" link to "/jobs"

  # AC-11
  Scenario Outline: Show validation error for invalid <field>
    Given I am on the Submit CV page
    And I fill in all fields with a valid CV "cv.pdf"
    When I set "<field>" to "<value>"
    And I click the "Submit CV" button
    Then I see the error "<error>"
    And the submit CV API is not called

    Examples:
      | field     | value          | error                                       |
      | Name      | <empty>        | Name is required                            |
      | Email     | <empty>        | Email is required                           |
      | Email     | not-an-email   | Invalid email address                       |
      | Position  | <empty>        | Please select a position                    |
      | Upload CV | <empty>        | Please upload your CV                       |
      | Upload CV | notes.txt      | Only PDF files are accepted                 |
      | Upload CV | cv.docx        | Only PDF files are accepted                 |
      | Upload CV | big.pdf (11MB) | File size must not exceed 10MB              |
      | Consent   | unchecked      | Please agree to the privacy policy to apply |

  # AC-11
  Scenario: Accept a PDF without MIME type
    Given I am on the Submit CV page
    And the submit CV API responds successfully
    When I fill in all fields with a valid CV "cv.pdf" without MIME type
    And I click the "Submit CV" button
    Then I see the message "Submit CV successfully"

  # AC-11
  Scenario: Clear a field error when the field is edited
    Given I am on the Submit CV page
    And I click the "Submit CV" button
    And I see the error "Name is required"
    When I type "Jane Doe" into "Name"
    Then I no longer see the error "Name is required"

  # AC-11
  Scenario: Show validation errors in Vietnamese
    Given I am on the Submit CV page in Vietnamese
    When I click the "Nộp CV" button
    Then I see the error "Vui lòng nhập họ tên"
    And I see the error "Vui lòng đồng ý với chính sách quyền riêng tư để ứng tuyển"

  # AC-13
  Scenario: Show the translated API error when submission is rejected
    Given I am on the Submit CV page
    And the submit CV API rejects the application with code "POSITION_NOT_OPEN"
    When I fill in all fields with a valid CV "cv.pdf"
    And I click the "Submit CV" button
    Then I see the submit error "This position is not accepting applications"
    And the form keeps the entered data

  # AC-13
  Scenario: Show the API message when the error has no known code
    Given I am on the Submit CV page
    And the submit CV API responds with error "Something went wrong upstream"
    When I fill in all fields with a valid CV "cv.pdf"
    And I click the "Submit CV" button
    Then I see the submit error "Something went wrong upstream"

  # AC-13
  Scenario: Show a generic error when the network fails
    Given I am on the Submit CV page
    And the network is down
    When I fill in all fields with a valid CV "cv.pdf"
    And I click the "Submit CV" button
    Then I see the submit error "Failed to submit CV. Please try again."
    And the form keeps the entered data

  # AC-16
  Scenario: Switch the language while filling in the form
    Given I am on the Submit CV page
    And I type "Jane Doe" into "Name"
    And I click the "Submit CV" button
    And I see the error "Email is required"
    When the page is shown again in Vietnamese
    Then the "Họ tên" field still contains "Jane Doe"
    And I see the error "Vui lòng nhập email"
    And I no longer see the error "Email is required"
