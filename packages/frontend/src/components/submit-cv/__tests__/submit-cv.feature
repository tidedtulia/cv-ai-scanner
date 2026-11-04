Feature: Submit CV
  As a candidate
  I want to submit my CV for a position
  So that the company can review my application

  # AC-1
  Scenario: Show the submit CV form
    Given I am on the Submit CV page
    Then I see the "Name" field
    And I see the "Email" field
    And I see the "Position" field
    And I see the "Upload CV" field

  # AC-2
  Scenario: Show requirements of the selected position
    Given I am on the Submit CV page
    When I select the position "Backend Developer"
    Then I see the requirements "NestJS, PostgreSQL, Prisma ORM"

  # AC-3
  Scenario: Submit CV successfully
    Given I am on the Submit CV page
    And the submit CV API responds successfully
    When I fill in all fields with a valid CV "cv.pdf"
    And I click the Submit button
    Then I see the message "Submit CV successfully"
    And I see a "Back to home" link to "/"

  # AC-4
  Scenario Outline: Show validation error for invalid <field>
    Given I am on the Submit CV page
    And I fill in all fields with a valid CV "cv.pdf"
    When I set "<field>" to "<value>"
    And I click the Submit button
    Then I see the error "<error>"
    And the submit CV API is not called

    Examples:
      | field     | value          | error                                  |
      | Name      | <empty>        | Name is required                       |
      | Email     | <empty>        | Email is required                      |
      | Email     | not-an-email   | Invalid email address                  |
      | Position  | <empty>        | Please select a position               |
      | Upload CV | <empty>        | Please upload your CV                  |
      | Upload CV | notes.txt      | Only PDF, DOC, DOCX files are accepted |
      | Upload CV | big.pdf (11MB) | File size must not exceed 10MB         |

  # AC-4
  Scenario: Accept a .docx file without MIME type
    Given I am on the Submit CV page
    And the submit CV API responds successfully
    When I fill in all fields with a valid CV "cv.docx" without MIME type
    And I click the Submit button
    Then I see the message "Submit CV successfully"

  # AC-4
  Scenario: Clear a field error when the field is edited
    Given I am on the Submit CV page
    And I click the Submit button
    And I see the error "Name is required"
    When I type "Jane Doe" into "Name"
    Then I no longer see the error "Name is required"

  # AC-5
  Scenario: Show the API error message when submission is rejected
    Given I am on the Submit CV page
    And the submit CV API responds with error "Missing fields"
    When I fill in all fields with a valid CV "cv.pdf"
    And I click the Submit button
    Then I see the submit error "Missing fields"
    And the form keeps the entered data

  # AC-5
  Scenario: Show a generic error when the network fails
    Given I am on the Submit CV page
    And the network is down
    When I fill in all fields with a valid CV "cv.pdf"
    And I click the Submit button
    Then I see the submit error "Failed to submit CV. Please try again."
    And the form keeps the entered data
