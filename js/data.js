/*
  Toàn bộ nội dung của app: giáo án mẫu, danh mục lựa chọn, thư viện, slide,
  văn bản pháp lý, dữ liệu quản trị.

  Mọi chuỗi tiếng Việt ở đây lấy nguyên văn từ bản thiết kế
  `App Tạo Giáo Án.dc.html`. Sửa nội dung app thì sửa file này, không cần
  chạm vào app.js.

  Script cổ điển: gán vào window.DATA để app.js dùng lại.
*/
(function () {
  'use strict';

  /* Giáo án mẫu — hàm sampleLesson() của bản thiết kế.
     Trả về bản mới mỗi lần gọi để người dùng sửa bản này không ảnh hưởng bản kia. */
  function sampleLesson() {
    return {
      info: {
        school: 'Trường Mầm non Hoa Sen',
        teacher: 'Nguyễn Hồng Thương',
        className: 'Lớp ghép Hoa Cúc',
        ageLabel: 'Lớp ghép: 3–4 tuổi và 4–5 tuổi',
        size: '24 trẻ',
        date: '12/09/2026',
        theme: 'Bản thân',
        subtheme: 'Cảm xúc của tôi',
        activity: 'Khi con tức giận',
        domain: 'Phát triển tình cảm và kỹ năng xã hội',
        type: 'giáo dục cảm xúc',
        duration: '25–30 phút',
        place: 'Phòng học lớp Hoa Cúc',
        form: 'Kết hợp cả lớp và nhóm nhỏ'
      },
      objectives: {
        knowledge: [
          'Trẻ nói được tên cảm xúc tức giận và chỉ ra biểu hiện trên khuôn mặt, cơ thể.',
          'Trẻ kể được một tình huống ở lớp thường làm mình tức giận.'
        ],
        skills: [
          'Trẻ thực hiện được ba nhịp hít vào – thở ra chậm khi tức giận.',
          'Trẻ nói được câu "Con đang tức giận" và chọn được góc bình tĩnh.'
        ],
        attitude: [
          'Trẻ chờ đến lượt, không giành đồ chơi của bạn.',
          'Trẻ chủ động nhờ cô giúp khi chưa tự bình tĩnh được.'
        ],
        integrated: [
          'Quyền được lắng nghe: trẻ nói ý kiến của mình và được cô nhắc lại ý đó.',
          'Năng lực số: trẻ xem cùng cô đoạn hình ảnh biểu cảm 2 phút trên tivi lớp, có cô hướng dẫn.'
        ],
        differentiated: [
          {
            group: 'Nhóm 3–4 tuổi',
            items: [
              'Nói được tên cảm xúc tức giận khi nhìn tranh.',
              'Làm theo cô động tác hít – thở cùng gấu bông.',
              'Chọn đúng tranh mặt tức giận trong ba tranh.'
            ]
          },
          {
            group: 'Nhóm 4–5 tuổi',
            items: [
              'Kể lại tình huống làm mình tức giận và cách mình đã làm.',
              'Tự thực hiện ba nhịp hít – thở rồi nhắc bạn nhỏ cùng làm.',
              'Đề xuất một cách giải quyết khi hai bạn cùng muốn một món đồ chơi.'
            ]
          }
        ]
      },
      prep: {
        teacher: [
          'Bộ 4 tranh biểu cảm khổ A4: vui, buồn, tức giận, bình tĩnh.',
          'Gấu bông "bạn Bông" làm nhân vật dẫn dắt.',
          'Nhạc không lời nhẹ để chuyển hoạt động.'
        ],
        children: [
          'Mỗi trẻ một thẻ mặt cảm xúc hai mặt: tức giận – bình tĩnh.',
          'Chong chóng giấy để tập thở.'
        ],
        environment: [
          'Trẻ ngồi hình chữ U trên thảm.',
          'Góc bình tĩnh kê sát tường, có gối và hai quyển tranh.'
        ],
        materials: ['Thẻ hình bốn bước bình tĩnh: dừng – gọi tên – hít thở – nói ra.'],
        digital: ['Đoạn hình ảnh biểu cảm 2 phút phát trên tivi lớp, cô điều khiển.'],
        safety: [
          'Cất chong chóng ngay sau khi tập thở.',
          'Không để trẻ chạy khi chuyển về góc bình tĩnh.',
          'Giới hạn thời gian nhìn màn hình 2 phút.'
        ],
        backup: [
          'Nếu tivi lỗi, dùng bộ tranh biểu cảm A4 thay thế.',
          'Nếu trẻ quá hưng phấn, chuyển trò chơi vận động thành trò chơi tại chỗ.'
        ]
      },
      activities: [
        {
          name: 'Ổn định, tạo hứng thú', time: '3 phút',
          teacher: [
            'Cô cho trẻ hát và vận động theo bài "Bạn Bông chào cả lớp".',
            'Cô hỏi: "Hôm nay bạn Bông đến lớp với khuôn mặt thế nào?"'
          ],
          child: [
            'Trẻ hát và làm động tác cùng cô.',
            'Trẻ trả lời tự do: "bạn Bông mếu ạ", "bạn ấy giận ạ".'
          ],
          responses: 'Trẻ nhỏ chỉ tay vào mặt gấu bông; trẻ lớn gọi tên cảm xúc.',
          support: 'Cô đưa gấu bông sát lại, gợi ý bằng câu hỏi có hai lựa chọn: "vui hay giận?".',
          extend: 'Mời trẻ lớn làm lại khuôn mặt tức giận cho cả lớp xem.',
          safety: 'Nhắc trẻ vận động tại chỗ, không chen lấn.'
        },
        {
          name: 'Dẫn dắt vấn đề', time: '4 phút',
          teacher: [
            'Cô kể tình huống ngắn: bạn Bông đang xếp hình thì bị bạn khác lấy mất khối gỗ.',
            'Cô hỏi: "Nếu là con, con sẽ cảm thấy thế nào? Con sẽ làm gì?"'
          ],
          child: [
            'Trẻ nghe và trả lời theo suy nghĩ của mình.',
            'Trẻ kể lại chuyện tương tự đã xảy ra với mình.'
          ],
          responses: '"Con giận", "con mách cô", "con giành lại". Cô ghi nhận mọi câu trả lời.',
          support: 'Cô nhắc lại ý của trẻ bằng câu đầy đủ để trẻ nghe rõ ý mình.',
          extend: 'Hỏi trẻ lớn: "Cách nào làm cả hai bạn đều vui?"',
          safety: 'Không dùng tình huống gây sợ hãi hoặc quy lỗi cho trẻ nào.'
        },
        {
          name: 'Hoạt động trọng tâm: nhận diện và gọi tên cảm xúc', time: '8 phút',
          teacher: [
            'Cô lần lượt đưa 4 tranh biểu cảm, hỏi trẻ đây là cảm xúc gì và vì sao con biết.',
            'Cô cho trẻ xem cùng cô đoạn hình ảnh biểu cảm 2 phút trên tivi, rồi tắt màn hình.',
            'Cô chia hai nhóm nhỏ theo độ tuổi và phát thẻ mặt cảm xúc.'
          ],
          child: [
            'Trẻ quan sát, gọi tên cảm xúc và mô tả dấu hiệu: mặt đỏ, nhíu mày, nắm tay.',
            'Nhóm 3–4 tuổi chọn tranh mặt tức giận trong ba tranh.',
            'Nhóm 4–5 tuổi kể tình huống của mình và lật thẻ đúng cảm xúc.'
          ],
          responses: 'Trẻ nhỏ gọi được tên cảm xúc; trẻ lớn nêu được cả nguyên nhân.',
          support: 'Cô làm mẫu khuôn mặt và cho trẻ soi gương nhỏ để đối chiếu.',
          extend: 'Trẻ lớn giúp bạn nhỏ tìm tranh và nói giúp lý do.',
          safety: 'Tắt màn hình ngay khi hết 2 phút, cô ngồi cùng trẻ trong suốt thời gian xem.'
        },
        {
          name: 'Trẻ thực hành bốn bước bình tĩnh', time: '7 phút',
          teacher: [
            'Cô giới thiệu thẻ hình bốn bước: dừng – gọi tên – hít thở – nói ra.',
            'Cô làm mẫu ba nhịp hít vào thở ra với chong chóng, rồi mời trẻ làm cùng.',
            'Cô đưa từng nhóm về góc bình tĩnh để trẻ thử nói câu "Con đang tức giận".'
          ],
          child: [
            'Trẻ nhắc lại tên bốn bước theo thẻ hình.',
            'Trẻ thổi chong chóng ba nhịp, tự đếm cùng cô.',
            'Trẻ lần lượt vào góc bình tĩnh và nói câu của mình.'
          ],
          responses: 'Trẻ nhỏ thổi được nhưng chưa đếm; trẻ lớn tự đếm và nhắc bạn.',
          support: 'Cô đặt tay trẻ lên bụng để trẻ cảm nhận hơi thở, đếm giúp trẻ.',
          extend: 'Trẻ lớn hướng dẫn lại một bạn nhỏ, làm "bạn hướng dẫn".',
          safety: 'Cất chong chóng ngay sau khi dùng; trẻ đi bộ, không chạy về góc bình tĩnh.'
        },
        {
          name: 'Trò chơi củng cố: Đèn cảm xúc', time: '5 phút',
          teacher: [
            'Cô nêu luật: đèn đỏ thì dừng, đèn vàng thì hít thở, đèn xanh thì nói ra điều mình muốn.',
            'Cô nâng thẻ màu và quan sát cách trẻ phản ứng.'
          ],
          child: [
            'Trẻ chơi theo thẻ màu của cô.',
            'Trẻ nói câu ngắn ở đèn xanh: "Con muốn chơi cùng bạn".'
          ],
          responses: 'Một vài trẻ nhỏ làm chậm hơn nhịp; cô cho chơi lại lần hai chậm hơn.',
          support: 'Cô ghép trẻ nhỏ với một bạn lớn thành cặp.',
          extend: 'Cho trẻ lớn thay cô nâng thẻ màu một lượt.',
          safety: 'Chơi tại chỗ trong vòng thảm, giữ khoảng cách giữa các trẻ.'
        },
        {
          name: 'Nhận xét, kết thúc và chuyển hoạt động', time: '3 phút',
          teacher: [
            'Cô hỏi: "Hôm nay khi tức giận con sẽ làm gì đầu tiên?"',
            'Cô nhận xét cụ thể hành vi của trẻ, không so sánh giữa các trẻ.',
            'Cô bật nhạc nhẹ và mời trẻ chuyển sang hoạt động góc.'
          ],
          child: [
            'Trẻ trả lời và làm lại động tác hít thở.',
            'Trẻ cất thẻ cảm xúc vào rổ rồi về góc chơi.'
          ],
          responses: 'Trẻ nêu được ít nhất một bước trong bốn bước bình tĩnh.',
          support: 'Cô nhắc bằng thẻ hình nếu trẻ chưa nhớ.',
          extend: 'Gợi ý trẻ lớn dán thẻ bốn bước lên góc bình tĩnh của lớp.',
          safety: 'Trẻ cất đồ dùng trước khi di chuyển để tránh vướng chân.'
        }
      ]
    };
  }

  window.DATA = {
    sampleLesson: sampleLesson,

    /* Giáo viên đang đăng nhập — bản thiết kế ghi cứng ở thanh bên. */
    user: { initials: 'HT', name: 'Khổng Hồng Thương', role: 'Giáo viên · MN Phúc Than' },

    /* 5 điểm giới thiệu ở màn hình đăng nhập. */
    loginFeatures: [
      { n: '1', title: 'Wizard 5 bước', body: 'Thông tin, mục tiêu, nội dung tích hợp, phương pháp, tạo và kiểm tra.' },
      { n: '2', title: 'Đúng bố cục I – II – III', body: 'Bảng hai cột hoạt động của cô và hoạt động của trẻ.' },
      { n: '3', title: 'Lớp ghép nhiều độ tuổi', body: 'Mục tiêu chung, mục tiêu phân hóa và nhiệm vụ riêng theo nhóm.' },
      { n: '4', title: 'Word và PowerPoint', body: 'Xem trước rồi tải .docx, hoặc tóm tắt thành slide 16:9.' },
      { n: '5', title: 'Kiểm tra chuyên môn', body: 'Cảnh báo an toàn, quá tải, thời lượng và phân hóa trước khi dùng.' }
    ],

    /* Thanh điều hướng: [mã màn hình, nhãn]. */
    nav: [
      ['dashboard', 'Trang chủ'],
      ['wizard', 'Tạo giáo án'],
      ['editor', 'Trình soạn thảo'],
      ['library', 'Giáo án của tôi'],
      ['templates', 'Thư viện mẫu'],
      ['upload', 'Tải Word lên'],
      ['word', 'Xem trước Word'],
      ['ppt', 'Xem trước PowerPoint'],
      ['refs', 'Căn cứ và tham chiếu'],
      ['admin', 'Quản trị']
    ],

    suggested: [
      { age: 'LỚP GHÉP', title: 'Hoạt động trải nghiệm chăm sóc cây' },
      { age: '3–4 & 4–5 TUỔI', title: 'Con có quyền được lắng nghe' },
      { age: 'LỚP GHÉP', title: 'Khám phá màu sắc theo nhóm nhỏ' }
    ],

    /* Nhãn 5 bước của wizard. */
    stepLabels: ['Thông tin cơ bản', 'Mục tiêu', 'Nội dung tích hợp', 'Phương pháp', 'Tạo và kiểm tra'],

    /* Danh mục chip. */
    options: {
      ages: ['Trẻ 18–24 tháng', 'Trẻ 24–36 tháng', 'Trẻ 3–4 tuổi', 'Trẻ 4–5 tuổi', 'Trẻ 5–6 tuổi', 'Lớp ghép nhiều độ tuổi'],
      mixedAges: ['Trẻ 18–24 tháng', 'Trẻ 24–36 tháng', 'Trẻ 3–4 tuổi', 'Trẻ 4–5 tuổi', 'Trẻ 5–6 tuổi'],
      domains: [
        'Phát triển thể chất', 'Phát triển nhận thức', 'Phát triển ngôn ngữ',
        'Phát triển tình cảm và kỹ năng xã hội', 'Phát triển thẩm mỹ', 'Phát triển đa lĩnh vực'
      ],
      types: [
        'Làm quen văn học', 'Kể chuyện', 'Đọc thơ', 'Làm quen chữ cái', 'Làm quen với toán',
        'Khám phá khoa học', 'Khám phá xã hội', 'Tạo hình', 'Âm nhạc', 'Vận động', 'Kỹ năng sống',
        'Hoạt động STEAM', 'Hoạt động Montessori', 'Giáo dục cảm xúc', 'An toàn và phòng tránh',
        'Quyền trẻ em', 'Năng lực số', 'Hoạt động trải nghiệm', 'Hoạt động ngoài trời',
        'Hoạt động góc', 'Theo dự án', 'Tùy chỉnh'
      ],
      levels: ['Cần hỗ trợ nhiều', 'Trung bình', 'Khá tốt'],
      supports: ['2 trẻ chậm nói', '1 trẻ tăng động', '1 trẻ khiếm thính', 'Trẻ mới nhập lớp'],
      integrations: [
        'STEAM', 'Montessori', 'Giáo dục cảm xúc', 'An toàn và phòng tránh', 'Quyền trẻ em',
        'Năng lực số', 'Hoạt động trải nghiệm', 'Ứng dụng AI', 'Kể chuyện', 'Đọc thơ', 'Bài hát',
        'Trò chơi', 'Văn hóa địa phương', 'Bảo vệ môi trường', 'Giáo dục hòa nhập'
      ],
      details: [
        ['Giáo án ngắn gọn', 'Rút gọn cho tiết quen'],
        ['Giáo án tiêu chuẩn', 'Dùng hằng ngày'],
        ['Giáo án chi tiết', 'Có lời dẫn đầy đủ'],
        ['Giáo án thao giảng', 'Trình bày kỹ, có dự kiến'],
        ['Giáo án dự giờ', 'Trang trọng, đủ căn cứ'],
        ['Giáo án lớp ghép', 'Phân hóa theo nhóm tuổi'],
        ['Giáo án theo dự án', 'Chuỗi nhiều buổi'],
        ['Có ứng dụng công nghệ', 'Kèm học liệu số']
      ],
      tones: ['Chuẩn chuyên môn', 'Gần gũi, dễ thực hiện', 'Sáng tạo', 'Trang trọng dùng cho dự giờ'],
      libFilters: ['Tất cả', 'Đã ghim', '4–5 tuổi', '5–6 tuổi', 'Lớp ghép', 'Nhận thức'],
      slideCounts: ['6–8 slide', '9–12 slide', '13–15 slide', 'Tự động đề xuất']
    },

    /* Nhãn các khối mục tiêu và phần chuẩn bị: [khóa trong giáo án, nhãn]. */
    objectiveLabels: [
      ['knowledge', '1. Kiến thức'],
      ['skills', '2. Kỹ năng'],
      ['attitude', '3. Thái độ'],
      ['integrated', '4. Mục tiêu tích hợp']
    ],
    prepLabels: [
      ['teacher', 'Đồ dùng của cô'],
      ['children', 'Đồ dùng của trẻ'],
      ['environment', 'Môi trường tổ chức'],
      ['materials', 'Học liệu và thiết bị'],
      ['digital', 'Học liệu số'],
      ['safety', 'Biện pháp bảo đảm an toàn'],
      ['backup', 'Phương án dự phòng']
    ],

    /* Thư viện giáo án. */
    library: [
      { id: 'p1', title: 'Khi con tức giận', age: 'LỚP GHÉP 3–4 & 4–5 TUỔI', domain: 'Tình cảm và kỹ năng xã hội', theme: 'Bản thân', date: '12/09/2026' },
      { id: 'p2', title: 'STEAM: làm cầu cho ô tô đồ chơi', age: '4–5 TUỔI', domain: 'Đa lĩnh vực', theme: 'Phương tiện giao thông', date: '09/09/2026' },
      { id: 'p3', title: 'Khám phá vòng đời của cây', age: '5–6 TUỔI', domain: 'Nhận thức', theme: 'Thế giới thực vật', date: '05/09/2026' },
      { id: 'p4', title: 'Không đi theo người lạ', age: '4–5 TUỔI', domain: 'Tình cảm và kỹ năng xã hội', theme: 'An toàn', date: '02/09/2026' },
      { id: 'p5', title: 'Kể chuyện về con vật', age: '24–36 THÁNG', domain: 'Ngôn ngữ', theme: 'Động vật', date: '28/08/2026' },
      { id: 'p6', title: 'Sử dụng thiết bị cùng người lớn', age: '5–6 TUỔI', domain: 'Đa lĩnh vực', theme: 'Năng lực số', date: '26/08/2026' }
    ],

    /* Thư viện mẫu: [nhóm tuổi, tên, lĩnh vực]. */
    templates: [
      ['18–24 THÁNG', 'Nhận biết quả bóng', 'Phát triển nhận thức'],
      ['24–36 THÁNG', 'Kể chuyện về con vật', 'Phát triển ngôn ngữ'],
      ['3–4 TUỔI', 'Khám phá màu sắc', 'Phát triển thẩm mỹ'],
      ['4–5 TUỔI', 'STEAM: làm cầu cho ô tô đồ chơi', 'Phát triển đa lĩnh vực'],
      ['5–6 TUỔI', 'Khám phá vòng đời của cây', 'Phát triển nhận thức'],
      ['LỚP GHÉP', 'Hoạt động trải nghiệm chăm sóc cây', 'Phát triển đa lĩnh vực'],
      ['4–5 TUỔI', 'Khi con tức giận', 'Giáo dục cảm xúc'],
      ['4–5 TUỔI', 'Không đi theo người lạ', 'An toàn và phòng tránh'],
      ['5–6 TUỔI', 'Con có quyền được lắng nghe', 'Quyền trẻ em'],
      ['5–6 TUỔI', 'Sử dụng thiết bị cùng người lớn', 'Năng lực số']
    ],

    /*
      Các việc "Nhờ AI chỉnh sửa": [nhãn nút, nhãn hộp xem trước].
      Nội dung bản xem trước do js/compose.js dựng, khóa theo nhãn nút.
    */
    aiActions: [
      ['Viết lại hoạt động trọng tâm', 'Viết lại hoạt động trọng tâm'],
      ['Rút gọn giáo án', 'Rút gọn giáo án'],
      ['Bổ sung một trò chơi củng cố', 'Bổ sung trò chơi củng cố'],
      ['Chuyển sang nhóm tuổi 5–6 tuổi', 'Chuyển sang 5–6 tuổi'],
      ['Tăng tính trải nghiệm', 'Tăng tính trải nghiệm'],
      ['Kiểm tra an toàn', 'Kiểm tra an toàn'],
      ['Kiểm tra chính tả tiếng Việt', 'Kiểm tra chính tả']
    ],

    /* Định dạng file Word — thông số thật mà js/docx.js áp dụng. */
    wordSettings: [
      { k: 'Khổ giấy', v: 'A4 dọc' },
      { k: 'Lề', v: '2 / 2 / 3 / 2 cm' },
      { k: 'Font', v: 'Times New Roman' },
      { k: 'Cỡ chữ', v: '14' },
      { k: 'Giãn dòng', v: '1.15' },
      { k: 'Khu vực ký tên', v: 'Bật' }
    ],

    uploadSteps: ['1. Tải lên', '2. Đọc nội dung', '3. Kiểm tra ánh xạ', '4. Tạo slide'],

    /* Văn bản pháp lý: [số hiệu, tên, cơ quan, hiệu lực, trạng thái, kiểm tra gần nhất]. */
    refs: [
      ['01/VBHN-BGDĐT', 'Chương trình Giáo dục mầm non (văn bản hợp nhất)', 'Bộ Giáo dục và Đào tạo', '13/04/2021', 'Đang có hiệu lực', '01/08/2026'],
      ['51/2020/TT-BGDĐT', 'Sửa đổi, bổ sung Chương trình Giáo dục mầm non', 'Bộ Giáo dục và Đào tạo', '31/12/2020', 'Đang có hiệu lực', '01/08/2026'],
      ['45/2021/TT-BGDĐT', 'Trường học an toàn, phòng chống tai nạn thương tích', 'Bộ Giáo dục và Đào tạo', '31/12/2021', 'Đang có hiệu lực', '01/08/2026'],
      ['Luật Trẻ em', 'Luật Trẻ em và văn bản hợp nhất hiện hành', 'Quốc hội', '01/06/2017', 'Đang có hiệu lực', '01/08/2026'],
      ['02/2025/TT-BGDĐT', 'Khung năng lực số cho người học', 'Bộ Giáo dục và Đào tạo', '2025', 'Đang có hiệu lực', '01/08/2026'],
      ['18/2026/TT-BGDĐT', 'Khung năng lực số cho giáo viên và cán bộ quản lý', 'Bộ Giáo dục và Đào tạo', '2026', 'Chưa xác minh', '01/08/2026'],
      ['51/2026/TT-BGDĐT', 'Quản trị viên cần nhập đúng ngày có hiệu lực', 'Bộ Giáo dục và Đào tạo', 'Chờ nhập', 'Sắp có hiệu lực', '01/08/2026']
    ],

    adminStats: [
      { value: '126', label: 'Giáo viên' },
      { value: '1.842', label: 'Giáo án' },
      { value: '318', label: 'Lượt AI tuần này' },
      { value: '7', label: 'Mẫu hệ thống' }
    ],

    /* Người dùng: [tên, trường, vai trò, lượt AI hôm nay]. */
    users: [
      ['Nguyễn Hồng Thương', 'MN Hoa Sen', 'Giáo viên', '5/8'],
      ['Trần Thu Hà', 'MN Hoa Sen', 'Giáo viên', '2/8'],
      ['Lê Minh Anh', 'MN Ánh Dương', 'Quản trị viên', '1/50'],
      ['Phạm Bảo Ngọc', 'MN Sao Mai', 'Giáo viên', '8/8'],
      ['Đỗ Thanh Vân', 'MN Ánh Dương', 'Giáo viên', '0/8']
    ],

    prompts: [
      { name: 'Tạo giáo án', version: 'v4.2' },
      { name: 'Kiểm tra chuyên môn', version: 'v2.0' },
      { name: 'Tóm tắt sang slide', version: 'v1.8' },
      { name: 'Phân tích file Word', version: 'v1.3' }
    ],

    /* Giới hạn và tính năng: [nhãn, khóa trong state.adminToggles]. */
    toggles: [
      ['Cho phép gọi AI', 'ai'],
      ['Cho phép tải Word lên', 'upload'],
      ['Giáo viên xem được nhật ký', 'admin'],
      ['Mở tính năng thử nghiệm', 'beta']
    ],

    /* Câu nhắc trách nhiệm chuyên môn, dùng ở hai chỗ trong bản thiết kế. */
    disclaimer: 'Nội dung do AI hỗ trợ xây dựng. Giáo viên cần kiểm tra và điều chỉnh theo kế hoạch giáo dục của cơ sở, điều kiện lớp học và văn bản đang có hiệu lực.'
  };
})();
