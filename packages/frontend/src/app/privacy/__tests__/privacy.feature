Feature: Privacy policy
  As a candidate
  I want to know how my personal data and CV are handled
  So that I can agree to it before applying

  # AC-14
  Scenario Outline: Explain how personal data is handled
    Given my browser prefers "<language>"
    When I open the privacy page
    Then I see the main heading "<title>"
    And the page shows when it was last updated
    And I see the sections "<sections>"
    And the page says "<ai>"
    And the page says "<retention>"
    And the page says "<contact>"

    Examples:
      | language | title                      | sections                                                                                                                                      | ai                    | retention                    | contact                |
      | en       | Privacy policy             | Data we collect, How we use it, AI-assisted screening, Where it is stored, How long we keep it, Your rights, Your consent                      | Claude, by Anthropic  | 12 months after you apply    | trantrieu491@gmail.com |
      | vi       | Chính sách quyền riêng tư  | Dữ liệu chúng tôi thu thập, Mục đích sử dụng, Sàng lọc có hỗ trợ của AI, Nơi lưu trữ, Thời hạn lưu trữ, Quyền của bạn, Sự đồng ý của bạn | Claude, của Anthropic | trong 12 tháng kể từ khi bạn | trantrieu491@gmail.com |
