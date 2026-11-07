Feature: HR application detail (hr-applications AC-13 → AC-15, AC-18)

  Scenario: Header and AI result (AC-13)
    Given my browser prefers Vietnamese
    When I open the application "a1" from the list "tab=all&q=an"
    Then the back link "← Danh sách đơn" goes to "/hr?tab=all&q=an"
    And I see the heading "Nguyễn Văn An" with "an@example.com", "Backend Developer", "Developer", "Middle" and "Nộp ngày 07/11/2026"
    And I see the status "Đã chấm"
    And I see the overall score "83.3" with "Nên nhận"
    And I see "Yêu cầu: Middle, từ 2 năm" and "AI ước tính: Middle, 3.5 năm"
    And I see the summary "Ứng viên phù hợp."
    And I see the line "Chấm bởi claude-sonnet-5-5 · prompt v1 · 08/11/2026 00:01"

  Scenario: Score per criterion (AC-13, AC-18)
    Given my browser prefers Vietnamese
    When I open the application "a1" from the list ""
    Then the table "Điểm từng tiêu chí" has the columns "Tiêu chí, Loại, Trọng số, Điểm, Lý do, Trích từ CV"
    And the row "NestJS" shows "Kỹ thuật", "5", "9/10", "Có 3 năm NestJS" and "Built NestJS APIs"
    And the row "NestJS" has the "Bắt buộc" badge and the row "English" does not
    And I see the strengths "Thành thạo NestJS" and the weaknesses "Ít kinh nghiệm Prisma"

  Scenario: The CV is shown in the page (AC-13)
    When I open the application "a1" from the list ""
    Then the CV frame "CV of Nguyễn Văn An" shows "/api/hr/applications/a1/cv"
    And the link "Open in a new tab" opens "/api/hr/applications/a1/cv" in a new tab
    And the link "Download" downloads "CV An.pdf"

  Scenario Outline: No AI result yet or a failed one (AC-14)
    Given my browser prefers Vietnamese
    And the application is "<status>" without an AI result
    When I open the application "a1" from the list ""
    Then I see "<message>"

    Examples:
      | status            | message                                                  |
      | SUBMITTED         | AI sẽ chấm đơn này trong lần chạy 00:00 kế tiếp.         |
      | EVALUATING        | AI sẽ chấm đơn này trong lần chạy 00:00 kế tiếp.         |
      | EVALUATION_FAILED | AI chấm lỗi: Không tải được CV từ Google Drive           |

  Scenario: Re-evaluation requested, the old result is kept (AC-14)
    Given my browser prefers Vietnamese
    And the application is "SUBMITTED" with the old AI result
    When I open the application "a1" from the list ""
    Then I see "Kết quả cũ — đang chờ chấm lại"
    And I see the overall score "83.3" with "Nên nhận"

  Scenario: Status history and other applications (AC-15)
    Given my browser prefers Vietnamese
    And the application has a decision by "Lan HR" with the note "Hợp văn hoá" and another application "Frontend Developer"
    When I open the application "a1" from the list ""
    Then the history lists "Hệ thống" and "Lan HR" in this order
    And the history row of "Lan HR" shows "Đã chấm → Đã nhận" and "Hợp văn hoá"
    And the other application "Frontend Developer" links to "/hr/applications/o1" and shows "Đã từ chối" and "40"

  Scenario: No other applications (AC-15)
    When I open the application "a1" from the list ""
    Then I see no section "Other applications of this candidate"

  Scenario Outline: Unknown application (AC-18)
    When the HR API answers <status> for the application
    Then I see "Application not found."
    And the back link "← Applications" goes to "/hr"

    Examples:
      | status |
      | 404    |
      | 400    |

  Scenario: The backend fails (AC-18)
    When the HR API answers 500 for the application
    Then I see the alert "We could not load the applications right now. Please try again in a moment."
