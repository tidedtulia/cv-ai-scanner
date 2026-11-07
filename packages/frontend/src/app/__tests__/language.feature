Feature: Bilingual site (vi / en)
  As a candidate
  I want the site in my language
  So that I understand every step of applying

  # AC-15
  Scenario Outline: Pick the language from the browser on the first visit
    Given I have not chosen a language
    And my browser sends Accept-Language "<header>"
    When I open the home page
    Then the page is in "<language>"

    Examples:
      | header                  | language |
      | en-US,en;q=0.9          | en       |
      | vi-VN,vi;q=0.9,en;q=0.8 | vi       |
      | fr-FR,fr;q=0.9,en;q=0.5 | en       |
      | ja                      | vi       |
      | <none>                  | vi       |

  # AC-15
  Scenario: The chosen language wins over the browser
    Given I chose the language "en" before
    And my browser sends Accept-Language "vi-VN,vi;q=0.9"
    When I open the home page
    Then the page is in "en"

  # AC-16
  Scenario: Switch to English
    Given I have not chosen a language
    And my browser sends Accept-Language "vi"
    And I open the home page
    When I click the language button "EN"
    Then the cookie "locale=en" is saved for 1 year
    And the page is rendered again without changing the URL

  # AC-16
  Scenario: Clicking the current language does nothing
    Given I have not chosen a language
    And my browser sends Accept-Language "vi"
    And I open the home page
    When I click the language button "VI"
    Then the page is not rendered again

  # AC-17
  Scenario Outline: html lang and the tab title follow the language
    Given I have not chosen a language
    And my browser sends Accept-Language "<header>"
    When I open the "<page>" page
    Then the html lang is "<language>"
    And the browser tab title is "<title>"

    Examples:
      | header | page       | language | title                               |
      | vi     | jobs       | vi       | Việc làm đang tuyển · CV AI Scanner |
      | en     | jobs       | en       | Open jobs · CV AI Scanner           |
      | vi     | submit CV  | vi       | Nộp CV · CV AI Scanner              |
      | en     | privacy    | en       | Privacy policy · CV AI Scanner      |
      | en     | home       | en       | CV AI Scanner                       |
