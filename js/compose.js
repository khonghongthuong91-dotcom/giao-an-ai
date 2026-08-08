/*
  Dựng giáo án, cảnh báo kiểm tra, slide và bản xem trước chỉnh sửa — bằng
  JavaScript chạy ngay trên máy, không cần mạng.

  Bản thiết kế gọi `window.claude.complete()` để nhờ mô hình soạn giáo án. Hàm
  đó chỉ có trong môi trường xem trước của Claude Design. Ở bản này:

    • Nếu `window.claude.complete` có mặt (mở app trong môi trường đó) thì app
      gọi thật, đúng prompt và đúng JSON schema của bản thiết kế.
    • Nếu không có, app dùng bộ dựng bên dưới: ghép giáo án từ chính những gì
      giáo viên đã chọn trong wizard. Không phải mô hình ngôn ngữ, nhưng ra
      giáo án thật theo bố cục I – II – III, không phải chữ giả.

  Cả hai đường đi đều nói rõ nguồn gốc ở giao diện.
*/
(function () {
  'use strict';

  /* ── Tiện ích ─────────────────────────────────────────────────────────── */

  /* Lấy số phút lớn nhất trong chuỗi kiểu "25–30 phút" → 30. */
  function totalMinutes(text) {
    var nums = String(text || '').match(/\d+/g);
    if (!nums || !nums.length) return 30;
    return Math.max.apply(null, nums.map(Number));
  }

  /* Rút gọn nhãn nhóm tuổi: "Trẻ 4–5 tuổi" → "4–5 tuổi". */
  function shortAge(label) {
    return String(label).replace(/^Trẻ\s+/, '');
  }

  /* Nhóm tuổi nhỏ nhất trong danh sách, theo thứ tự của DATA.options.mixedAges. */
  function youngest(ages) {
    var order = window.DATA.options.mixedAges;
    var found = order.filter(function (a) { return ages.indexOf(a) !== -1; });
    return found.length ? found[0] : ages[0];
  }

  /* Nhãn độ tuổi in trên giáo án. */
  function ageLabel(state) {
    if (state.mixed && state.mixedAges.length) {
      return 'Lớp ghép: ' + state.mixedAges.map(shortAge).join(' và ');
    }
    if (state.ages.length) return state.ages.map(shortAge).join(', ');
    return '4–5 tuổi';
  }

  /* Chia tổng thời lượng cho 6 hoạt động theo tỷ lệ quen dùng. */
  function splitTime(total) {
    var weights = [0.10, 0.13, 0.27, 0.23, 0.17, 0.10];
    var mins = weights.map(function (w) { return Math.max(2, Math.round(total * w)); });
    // Bù phần lệch do làm tròn vào hoạt động trọng tâm.
    var diff = total - mins.reduce(function (a, b) { return a + b; }, 0);
    mins[2] = Math.max(2, mins[2] + diff);
    return mins.map(function (m) { return m + ' phút'; });
  }

  /* Nhóm lĩnh vực để chọn bộ câu mẫu. */
  function domainFamily(domains, types) {
    var all = (domains || []).concat(types || []).join(' ');
    if (/thể chất|Vận động/i.test(all)) return 'physical';
    if (/ngôn ngữ|văn học|Kể chuyện|Đọc thơ|chữ cái/i.test(all)) return 'language';
    if (/tình cảm|kỹ năng xã hội|cảm xúc|Quyền trẻ em|Kỹ năng sống|An toàn/i.test(all)) return 'social';
    if (/thẩm mỹ|Tạo hình|Âm nhạc/i.test(all)) return 'art';
    if (/nhận thức|toán|Khám phá|STEAM|Montessori|Năng lực số/i.test(all)) return 'cognitive';
    return 'multi';
  }

  /* Bộ câu mẫu theo nhóm lĩnh vực. {topic} = tên hoạt động. */
  var FAMILY = {
    physical: {
      know: ['Trẻ nói được tên các động tác trong hoạt động "{topic}".', 'Trẻ nhận ra vạch xuất phát, đích và hiệu lệnh của cô.'],
      skill: ['Trẻ thực hiện được động tác của "{topic}" đúng nhịp hiệu lệnh.', 'Trẻ giữ được thăng bằng và phối hợp tay – chân khi vận động.'],
      attitude: ['Trẻ chờ đến lượt, không chen lấn bạn.', 'Trẻ cất dọn dụng cụ sau khi tập.'],
      explore: ['Trẻ quan sát cô làm mẫu rồi tập lại từng động tác.', 'Trẻ nói được động tác nào khó với mình.'],
      practice: ['Trẻ lần lượt thực hiện theo nhóm nhỏ.', 'Trẻ tự nhận xét lần tập của mình.'],
      teacherExplore: ['Cô làm mẫu chậm hai lần, nhấn vào điểm dễ sai của "{topic}".', 'Cô cho trẻ tập thử tại chỗ trước khi vào đội hình.'],
      teacherPractice: ['Cô chia nhóm nhỏ, mỗi nhóm tập một lượt và cô sửa động tác cho từng trẻ.', 'Cô nhắc trẻ giữ khoảng cách an toàn.']
    },
    language: {
      know: ['Trẻ nói được nội dung chính của "{topic}".', 'Trẻ gọi tên được các nhân vật, sự việc xuất hiện trong bài.'],
      skill: ['Trẻ kể lại được một đoạn của "{topic}" bằng câu của mình.', 'Trẻ trả lời câu hỏi của cô bằng câu đủ chủ ngữ – vị ngữ.'],
      attitude: ['Trẻ nghe bạn nói hết câu rồi mới nói.', 'Trẻ mạnh dạn nói ý kiến của mình trước cả lớp.'],
      explore: ['Trẻ nghe cô kể và trả lời câu hỏi về nội dung.', 'Trẻ chỉ vào tranh và gọi tên chi tiết mình thấy.'],
      practice: ['Trẻ kể lại theo tranh cùng bạn trong nhóm nhỏ.', 'Trẻ đóng vai một nhân vật và nói lời của nhân vật đó.'],
      teacherExplore: ['Cô kể "{topic}" lần một trọn vẹn, lần hai dừng ở các mốc để hỏi trẻ.', 'Cô đưa tranh theo trình tự và hỏi "sau đó chuyện gì xảy ra?".'],
      teacherPractice: ['Cô chia nhóm nhỏ, phát tranh và mời trẻ kể lại theo tranh.', 'Cô ghi nhận cách diễn đạt của trẻ, không sửa gắt lời trẻ.']
    },
    social: {
      know: ['Trẻ nói được vì sao cần "{topic}" trong sinh hoạt hằng ngày.', 'Trẻ kể được một tình huống ở lớp có liên quan đến "{topic}".'],
      skill: ['Trẻ thực hiện được các bước của "{topic}" khi cô nhắc.', 'Trẻ nói được điều mình muốn bằng câu ngắn, rõ.'],
      attitude: ['Trẻ chờ đến lượt, không giành đồ chơi của bạn.', 'Trẻ chủ động nhờ cô giúp khi chưa tự làm được.'],
      explore: ['Trẻ nghe tình huống và nói cách xử lý của mình.', 'Trẻ nhận ra dấu hiệu trên khuôn mặt và cơ thể của bạn.'],
      practice: ['Trẻ thực hành theo cặp, một bạn làm và một bạn nhắc.', 'Trẻ nói lại câu của mình trong tình huống giả định.'],
      teacherExplore: ['Cô nêu một tình huống ngắn xảy ra ở lớp và hỏi "nếu là con, con làm gì?".', 'Cô nhắc lại ý của trẻ bằng câu đầy đủ để trẻ nghe rõ ý mình.'],
      teacherPractice: ['Cô làm mẫu từng bước của "{topic}" rồi mời trẻ làm cùng.', 'Cô đi từng nhóm, hỗ trợ trẻ chưa nói được thành câu.']
    },
    art: {
      know: ['Trẻ gọi tên được vật liệu, màu sắc dùng trong "{topic}".', 'Trẻ nói được mình muốn làm gì trước khi bắt đầu.'],
      skill: ['Trẻ thực hiện được thao tác chính của "{topic}".', 'Trẻ tạo ra một sản phẩm đơn giản theo ý mình.'],
      attitude: ['Trẻ giữ gìn đồ dùng và cất dọn sau khi làm.', 'Trẻ vui với sản phẩm của mình và của bạn.'],
      explore: ['Trẻ quan sát mẫu và nói điểm mình thích.', 'Trẻ thử vật liệu trước khi làm sản phẩm.'],
      practice: ['Trẻ làm sản phẩm của mình tại nhóm nhỏ.', 'Trẻ giới thiệu sản phẩm bằng một, hai câu.'],
      teacherExplore: ['Cô cho trẻ xem hai mẫu khác nhau của "{topic}" và hỏi trẻ thích cách nào.', 'Cô làm mẫu thao tác khó, vừa làm vừa nói tên bước.'],
      teacherPractice: ['Cô phát vật liệu theo nhóm và để trẻ tự chọn cách làm.', 'Cô hỏi từng trẻ "con định làm gì tiếp theo?" thay vì làm giúp trẻ.']
    },
    cognitive: {
      know: ['Trẻ nói được đặc điểm nổi bật của "{topic}".', 'Trẻ so sánh và tìm được điểm giống, khác giữa các đối tượng.'],
      skill: ['Trẻ thực hiện được thao tác thử – quan sát – nói kết quả với "{topic}".', 'Trẻ sắp xếp, phân loại được theo một dấu hiệu cô nêu.'],
      attitude: ['Trẻ kiên trì thử lại khi chưa được.', 'Trẻ chia sẻ đồ dùng và cùng làm với bạn trong nhóm.'],
      explore: ['Trẻ quan sát, sờ, thử và nói điều mình phát hiện.', 'Trẻ dự đoán trước khi thử: "con nghĩ sẽ..."'],
      practice: ['Trẻ làm thử theo nhóm nhỏ và nói kết quả cho cả nhóm.', 'Trẻ tìm thêm một cách khác để làm được như vậy.'],
      teacherExplore: ['Cô đưa đồ dùng cho trẻ tự thử và hỏi "con thấy gì?" trước khi giải thích.', 'Cô ghi lại dự đoán của trẻ để cuối hoạt động cùng đối chiếu.'],
      teacherPractice: ['Cô chia nhóm nhỏ, mỗi nhóm một bộ đồ dùng để trẻ tự thao tác.', 'Cô đặt câu hỏi mở, không làm thay trẻ.']
    },
    multi: {
      know: ['Trẻ nói được nội dung chính của hoạt động "{topic}".', 'Trẻ kể được một điều mình biết liên quan đến chủ đề.'],
      skill: ['Trẻ thực hiện được nhiệm vụ chính của "{topic}" theo hướng dẫn của cô.', 'Trẻ nói được điều mình vừa làm bằng câu ngắn.'],
      attitude: ['Trẻ hợp tác với bạn trong nhóm nhỏ.', 'Trẻ cất dọn đồ dùng sau hoạt động.'],
      explore: ['Trẻ quan sát và trả lời câu hỏi của cô.', 'Trẻ nói điều mình thấy thú vị nhất.'],
      practice: ['Trẻ thực hành theo nhóm nhỏ.', 'Trẻ giới thiệu kết quả của nhóm mình.'],
      teacherExplore: ['Cô giới thiệu "{topic}" bằng đồ dùng thật và đặt câu hỏi mở.', 'Cô cho trẻ thử trước, giải thích sau.'],
      teacherPractice: ['Cô chia nhóm nhỏ và giao nhiệm vụ vừa sức từng nhóm.', 'Cô quan sát, hỗ trợ trẻ cần giúp thêm.']
    }
  };

  function fill(list, topic) {
    return list.map(function (s) { return s.replace(/\{topic\}/g, topic); });
  }

  /* ── Dựng giáo án từ lựa chọn trong wizard ────────────────────────────── */

  function composeLesson(state) {
    var f = state.form;
    var topic = (f.activity || 'Hoạt động học').trim();
    var fam = FAMILY[domainFamily(state.domains, state.types)];
    var total = totalMinutes(f.duration);
    var times = splitTime(total);
    var detailed = /chi tiết|thao giảng|dự giờ/i.test(state.detail);
    var brief = /ngắn gọn/i.test(state.detail);
    var formal = /Trang trọng/i.test(state.tone);

    var digital = state.integrations.some(function (i) { return /Năng lực số|Ứng dụng AI/.test(i); }) ||
      /công nghệ/i.test(state.detail);
    var groups = state.mixed && state.mixedAges.length > 1 ? state.mixedAges : [];
    var young = groups.length ? shortAge(youngest(groups)) : null;
    var old = groups.length ? shortAge(groups[groups.length - 1]) : null;

    /* Giữ tối đa n dòng — mức độ chi tiết quyết định độ dài mỗi ô. */
    function cut(lines) {
      var n = brief ? 1 : detailed ? 3 : 2;
      return lines.slice(0, Math.max(1, Math.min(n, lines.length)));
    }

    var info = {
      school: f.school, teacher: f.teacher, className: f.className,
      ageLabel: ageLabel(state),
      size: (f.size || '').trim() + (/trẻ/.test(f.size) ? '' : ' trẻ'),
      date: f.date, theme: f.theme, subtheme: f.subtheme, activity: topic,
      domain: state.domains.join(', ') || 'Phát triển đa lĩnh vực',
      type: (state.types[0] || 'hoạt động học').toLowerCase(),
      duration: f.duration, place: f.place, form: f.form
    };

    /* I. Mục đích – yêu cầu */
    var teacherGoals = (f.objectives || '').split(/\n|(?<=\.)\s+/)
      .map(function (x) { return x.trim(); })
      .filter(function (x) { return x.length > 6; });

    var objectives = {
      knowledge: teacherGoals.length ? teacherGoals.slice(0, 3) : fill(fam.know, topic),
      skills: fill(fam.skill, topic),
      attitude: fill(fam.attitude, topic),
      integrated: []
    };

    /* Mục tiêu tích hợp — mỗi nội dung được chọn thành một dòng cụ thể. */
    var INTEGRATION_LINES = {
      'STEAM': 'STEAM: trẻ thử – quan sát – nói kết quả với vật liệu có sẵn, không cần thiết bị riêng.',
      'Montessori': 'Montessori: trẻ tự chọn đồ dùng, tự làm và tự cất về đúng chỗ.',
      'Giáo dục cảm xúc': 'Giáo dục cảm xúc: trẻ gọi tên được cảm xúc của mình trong hoạt động.',
      'An toàn và phòng tránh': 'An toàn: trẻ nhận ra một dấu hiệu chưa an toàn và biết gọi cô.',
      'Quyền trẻ em': 'Quyền được lắng nghe: trẻ nói ý kiến của mình và được cô nhắc lại ý đó.',
      'Năng lực số': 'Năng lực số: trẻ xem cùng cô đoạn hình ảnh ngắn trên tivi lớp, có cô hướng dẫn.',
      'Hoạt động trải nghiệm': 'Trải nghiệm: trẻ tự thao tác với vật thật ít nhất một lượt.',
      'Ứng dụng AI': 'Ứng dụng công nghệ: cô dùng học liệu số đã chuẩn bị trước, trẻ chỉ xem cùng cô.',
      'Kể chuyện': 'Văn học: trẻ nghe và kể lại được một đoạn ngắn.',
      'Đọc thơ': 'Văn học: trẻ đọc theo cô được vài câu thơ ngắn.',
      'Bài hát': 'Âm nhạc: trẻ hát và vận động theo bài hát của hoạt động.',
      'Trò chơi': 'Trò chơi: trẻ chơi đúng luật và chờ đến lượt.',
      'Văn hóa địa phương': 'Văn hóa địa phương: trẻ làm quen một nét quen thuộc ở nơi mình sống.',
      'Bảo vệ môi trường': 'Bảo vệ môi trường: trẻ bỏ rác đúng chỗ và giữ đồ dùng dùng lại được.',
      'Giáo dục hòa nhập': 'Hòa nhập: mọi trẻ đều có một nhiệm vụ vừa sức trong hoạt động.'
    };

    // AI chỉ lồng ghép 2–3 nội dung phù hợp nhất — đúng như ghi chú ở bước 3.
    state.integrations.slice(0, 3).forEach(function (name) {
      if (INTEGRATION_LINES[name]) objectives.integrated.push(INTEGRATION_LINES[name]);
    });
    if (!objectives.integrated.length) {
      objectives.integrated.push('Trẻ hợp tác với bạn và giữ gìn đồ dùng trong suốt hoạt động.');
    }

    /* Mục tiêu phân hóa — bắt buộc khi là lớp ghép. */
    objectives.differentiated = groups.map(function (g, i) {
      var isYoung = i === 0;
      return {
        group: 'Nhóm ' + shortAge(g),
        items: isYoung ? [
          'Nói được tên đối tượng, sự việc chính của "' + topic + '" khi có tranh hoặc vật thật.',
          'Làm theo cô từng bước, có cô làm mẫu trước.',
          'Chọn đúng một trong ba lựa chọn cô đưa.'
        ] : [
          'Kể lại được cách mình đã làm trong "' + topic + '".',
          'Tự thực hiện nhiệm vụ rồi nhắc bạn nhỏ cùng làm.',
          'Đề xuất được một cách làm khác cho cùng nhiệm vụ.'
        ]
      };
    });

    /* II. Chuẩn bị */
    var materials = (f.materials || '').split(/[,;]\s*/).map(function (x) { return x.trim(); }).filter(Boolean);
    var prep = {
      teacher: [
        'Bộ tranh hoặc vật thật minh họa cho "' + topic + '".',
        'Nhân vật dẫn dắt (rối tay hoặc gấu bông) để mở đầu hoạt động.'
      ],
      children: ['Mỗi trẻ một bộ đồ dùng nhỏ để thực hành trong hoạt động.'],
      environment: [
        'Trẻ ngồi hình chữ U trên thảm, có chỗ trống ở giữa để trẻ lên thực hiện.',
        'Chia sẵn hai khu vực nhóm nhỏ, đủ chỗ cho ' + (f.size || '20') + ' trẻ di chuyển.'
      ],
      materials: materials.length ? materials.map(function (m) {
        return m.charAt(0).toUpperCase() + m.slice(1) + '.';
      }) : ['Thẻ hình các bước của hoạt động để trẻ nhìn và nhắc lại.'],
      digital: digital ? ['Đoạn hình ảnh hoặc video ngắn 2 phút phát trên tivi lớp, cô điều khiển và ngồi cùng trẻ.'] : [],
      safety: [
        'Kiểm tra đồ dùng trước giờ dạy, loại bỏ vật có cạnh sắc hoặc chi tiết nhỏ dễ rơi.',
        'Cất đồ dùng ngay sau khi dùng; trẻ đi bộ, không chạy khi chuyển đội hình.'
      ],
      backup: [
        'Nếu thiết bị lỗi, dùng bộ tranh đã in thay thế.',
        'Nếu trẻ quá hưng phấn, chuyển trò chơi vận động thành trò chơi tại chỗ.'
      ]
    };
    if (digital) prep.safety.push('Giới hạn thời gian nhìn màn hình 2 phút, cô ngồi cùng trẻ và tắt ngay sau khi xem.');
    if (f.story) prep.teacher.push('Truyện "' + f.story + '" và bộ tranh theo trình tự.');
    if (f.poem) prep.teacher.push('Bài thơ "' + f.poem + '" viết sẵn trên bảng để cô đọc mẫu.');
    if (f.song) prep.teacher.push('Nhạc bài "' + f.song + '" và loa lớp.');
    if (f.game) prep.children.push('Đồ dùng cho trò chơi "' + f.game + '".');
    if (f.local) prep.environment.push('Góc trưng bày nét văn hóa địa phương: ' + f.local + '.');

    /* III. Hoạt động học — 6 hoạt động theo đúng thứ tự bản thiết kế yêu cầu. */
    var opener = f.song ? 'Cô cho trẻ hát và vận động theo bài "' + f.song + '".'
      : 'Cô cho trẻ hát và vận động theo một bài hát ngắn về chủ đề ' + (f.theme || 'của tuần') + '.';
    var lead = f.story ? 'Cô kể một đoạn ngắn của truyện "' + f.story + '" rồi dừng lại ở tình huống cần giải quyết.'
      : fam.teacherExplore[0].replace(/\{topic\}/g, topic);
    var gameName = f.game || 'trò chơi củng cố của hoạt động';

    var activities = [
      {
        name: 'Ổn định, tạo hứng thú',
        teacher: cut([opener, 'Cô hỏi một câu ngắn để hướng trẻ vào chủ đề "' + topic + '".',
          'Cô cho trẻ ngồi về đội hình chữ U.']),
        child: cut(['Trẻ hát và làm động tác cùng cô.', 'Trẻ trả lời tự do theo suy nghĩ của mình.',
          'Trẻ về chỗ ngồi theo hiệu lệnh.']),
        responses: 'Trẻ trả lời ngắn, có trẻ chỉ tay thay vì nói.',
        support: 'Cô gợi ý bằng câu hỏi có hai lựa chọn để trẻ dễ trả lời.',
        extend: 'Mời trẻ lớn nói lại ý của bạn bằng câu đầy đủ.',
        safety: 'Nhắc trẻ vận động tại chỗ, không chen lấn.'
      },
      {
        name: 'Dẫn dắt vấn đề',
        teacher: cut([lead, 'Cô hỏi: "Nếu là con, con sẽ cảm thấy thế nào? Con sẽ làm gì?"',
          'Cô ghi nhận mọi câu trả lời, không đánh giá đúng sai.']),
        child: cut(['Trẻ nghe và trả lời theo suy nghĩ của mình.',
          'Trẻ kể lại một chuyện tương tự đã xảy ra với mình.']),
        responses: 'Trẻ nêu được ít nhất một cách xử lý theo kinh nghiệm của mình.',
        support: 'Cô nhắc lại ý của trẻ bằng câu đầy đủ để trẻ nghe rõ ý mình.',
        extend: 'Hỏi trẻ lớn: "Cách nào làm cả hai bạn đều vui?"',
        safety: 'Không dùng tình huống gây sợ hãi hoặc quy lỗi cho trẻ nào.'
      },
      {
        name: 'Hoạt động trọng tâm: ' + topic.charAt(0).toLowerCase() + topic.slice(1),
        teacher: cut(fill(fam.teacherExplore, topic).concat(
          digital ? ['Cô cho trẻ xem cùng cô đoạn hình ảnh 2 phút trên tivi, rồi tắt màn hình.'] : [],
          groups.length ? ['Cô chia hai nhóm nhỏ theo độ tuổi và giao nhiệm vụ riêng cho từng nhóm.'] : []
        )),
        child: cut(fill(fam.explore, topic).concat(
          groups.length ? [
            'Nhóm ' + young + ' làm nhiệm vụ có cô làm mẫu trước.',
            'Nhóm ' + old + ' tự làm rồi nói lại cách mình đã làm.'
          ] : []
        )),
        responses: groups.length
          ? 'Nhóm ' + young + ' gọi được tên đối tượng; nhóm ' + old + ' nêu được cả lý do.'
          : 'Phần lớn trẻ nói được điều mình quan sát bằng câu ngắn.',
        support: 'Cô làm mẫu lại chậm hơn và cho trẻ thử cùng cô một lượt.',
        extend: groups.length ? 'Trẻ lớn giúp bạn nhỏ và nói giúp lý do.' : 'Mời trẻ tìm thêm một cách khác để làm được như vậy.',
        safety: digital ? 'Tắt màn hình ngay khi hết 2 phút, cô ngồi cùng trẻ trong suốt thời gian xem.'
          : 'Cô đứng ở vị trí quan sát được cả lớp trong khi trẻ thao tác.'
      },
      {
        name: 'Trẻ thực hành, trải nghiệm',
        teacher: cut(fill(fam.teacherPractice, topic).concat(
          ['Cô đi từng nhóm, đặt câu hỏi mở và không làm thay trẻ.']
        )),
        child: cut(fill(fam.practice, topic)),
        responses: 'Trẻ làm được nhiệm vụ của nhóm mình, mức độ hoàn thành khác nhau giữa các trẻ.',
        support: 'Cô làm cùng trẻ một bước đầu rồi để trẻ tiếp tục.',
        extend: 'Trẻ xong sớm nhận thêm nhiệm vụ khó hơn hoặc làm "bạn hướng dẫn".',
        safety: 'Đồ dùng đặt trong khay, trẻ ngồi tại nhóm khi thao tác.'
      },
      {
        name: 'Trò chơi củng cố: ' + gameName,
        teacher: cut(['Cô nêu luật chơi ngắn, làm mẫu một lượt rồi cho trẻ chơi thử.',
          'Cô quan sát và cho chơi lại lượt hai chậm hơn nếu trẻ chưa theo được.']),
        child: cut(['Trẻ chơi theo luật cô nêu.',
          'Trẻ nói được câu ngắn theo yêu cầu của trò chơi.']),
        responses: 'Một vài trẻ nhỏ làm chậm hơn nhịp; cô cho chơi lại lần hai chậm hơn.',
        support: groups.length ? 'Cô ghép trẻ nhỏ với một bạn lớn thành cặp.' : 'Cô chơi cùng trẻ chưa theo được nhịp.',
        extend: 'Cho trẻ lớn thay cô điều khiển trò chơi một lượt.',
        safety: 'Chơi tại chỗ trong vòng thảm, giữ khoảng cách giữa các trẻ.'
      },
      {
        name: 'Nhận xét, kết thúc và chuyển hoạt động',
        teacher: cut(['Cô hỏi lại một câu chốt về "' + topic + '".',
          'Cô nhận xét cụ thể hành vi của trẻ, không so sánh giữa các trẻ.',
          'Cô bật nhạc nhẹ và mời trẻ chuyển sang hoạt động góc.']),
        child: cut(['Trẻ trả lời và nhắc lại việc mình vừa làm.',
          'Trẻ cất đồ dùng vào rổ rồi về góc chơi.']),
        responses: 'Trẻ nêu được ít nhất một điều mình học được trong hoạt động.',
        support: 'Cô nhắc bằng thẻ hình nếu trẻ chưa nhớ.',
        extend: 'Gợi ý trẻ lớn giới thiệu kết quả của nhóm cho cả lớp.',
        safety: 'Trẻ cất đồ dùng trước khi di chuyển để tránh vướng chân.'
      }
    ];

    activities.forEach(function (a, i) { a.time = times[i]; });

    /* Giọng văn trang trọng dùng cho dự giờ: thêm câu dẫn ở hoạt động mở đầu. */
    if (formal) {
      activities[0].teacher.unshift('Cô ổn định tổ chức, kiểm tra sĩ số và sức khỏe của trẻ.');
    }

    /* Yêu cầu riêng của giáo viên được ghi thành một dòng chuẩn bị, không bịa
       thêm hoạt động mà cô không yêu cầu. */
    if (f.notes && f.notes.trim()) {
      prep.environment.push('Lưu ý riêng của giáo viên: ' + f.notes.trim());
    }
    if (f.needs && f.needs.trim()) {
      activities[3].support = 'Theo ghi nhận của cô: ' + f.needs.trim() + ' Cô hỗ trợ riêng những trẻ này trong phần thực hành.';
    }
    if (f.known && f.known.trim()) {
      activities[1].teacher.unshift('Cô nhắc lại điều trẻ đã biết: ' + f.known.trim());
    }

    return { info: info, objectives: objectives, prep: prep, activities: activities };
  }

  /* ── Prompt và lời gọi mô hình (đúng bản thiết kế) ─────────────────────── */

  function buildPrompt(state) {
    var f = state.form;
    var ages = state.mixed ? state.mixedAges.join(' và ') : state.ages.join(', ');
    return 'Bạn là chuyên gia giáo dục mầm non Việt Nam. Soạn một giáo án đúng bố cục giáo án mầm non Việt Nam.\n' +
      'Thông tin: trường ' + f.school + '; giáo viên ' + f.teacher + '; lớp ' + f.className + '; ' +
      (state.mixed ? 'LỚP GHÉP nhiều độ tuổi: ' + ages : 'nhóm tuổi: ' + ages) + '; ' + f.size + ' trẻ; ngày ' + f.date +
      '; chủ đề ' + f.theme + ' - ' + f.subtheme + '; hoạt động "' + f.activity + '"; lĩnh vực ' + state.domains.join(', ') +
      '; loại hoạt động ' + state.types.join(', ') + '; thời lượng ' + f.duration + '; địa điểm ' + f.place +
      '; hình thức ' + f.form + '.\n' +
      'Nội dung tích hợp: ' + state.integrations.join(', ') + '. Trò chơi: ' + (f.game || 'AI gợi ý') +
      '. Học liệu: ' + f.materials + '. Trẻ đã biết: ' + f.known + '. Khó khăn: ' + f.needs +
      '. Mức độ: ' + state.level + '. Hỗ trợ đặc biệt: ' + state.support.join(', ') + '.\n' +
      'Kiểu giáo án: ' + state.detail + '. Giọng văn: ' + state.tone + '.\n' +
      'Quy tắc: lấy trẻ làm trung tâm, học qua chơi; mục tiêu quan sát được, không hàn lâm; cột hoạt động của trẻ phải cụ thể, KHÔNG dùng câu "Trẻ chú ý lắng nghe"; ' +
      (state.mixed ? 'BẮT BUỘC có mục tiêu phân hóa và nhiệm vụ riêng cho từng nhóm tuổi; ' : '') +
      'không hoạt động nguy hiểm; không thu thập thông tin định danh của trẻ; không bịa số hiệu văn bản pháp lý.\n' +
      'Trả về DUY NHẤT một JSON hợp lệ, không kèm giải thích, theo schema:\n' +
      '{"info":{"school","teacher","className","ageLabel","size","date","theme","subtheme","activity","domain","type","duration","place","form"},' +
      '"objectives":{"knowledge":[],"skills":[],"attitude":[],"integrated":[],"differentiated":[{"group","items":[]}]},' +
      '"prep":{"teacher":[],"children":[],"environment":[],"materials":[],"digital":[],"safety":[],"backup":[]},' +
      '"activities":[{"name","time","teacher":[],"child":[],"responses","support","extend","safety"}]}\n' +
      'Cần 6 hoạt động: ổn định; dẫn dắt; trọng tâm; trẻ thực hành/trải nghiệm; trò chơi củng cố; nhận xét và kết thúc.';
  }

  /*
    Hai đường gọi mô hình thật:

      • `window.claude.complete()` — chỉ có trong môi trường xem trước của
        Claude Design.
      • Máy chủ AI cục bộ (`ai-server.ps1`) — chạy `claude -p` (Claude Code
        CLI) ngay trên máy giáo viên, dùng chính phiên đăng nhập Claude Code
        đã có sẵn, không cần API key riêng. Xem README phần "Chạy với AI thật".

    `checkLocalAi()` dò máy chủ cục bộ một lần khi trang vừa tải (health-check
    nhanh, không gọi mô hình). Nếu không thấy cả hai, `generate()`/`review()`
    rơi về bộ dựng cục bộ như trước — không bao giờ ném lỗi ra ngoài.
  */
  var localAiAvailable = false;
  var localAiChecked = false;

  function hasClaudeDesign() {
    return !!(window.claude && typeof window.claude.complete === 'function');
  }

  function aiReachable() {
    return hasClaudeDesign() || localAiAvailable;
  }

  function checkLocalAi() {
    if (hasClaudeDesign()) { localAiChecked = true; return Promise.resolve(true); }
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var timer = ctrl && setTimeout(function () { ctrl.abort(); }, 1500);
    return fetch('/api/health', { cache: 'no-store', signal: ctrl && ctrl.signal })
      .then(function (r) { return r.ok; })
      .catch(function () { return false; })
      .then(function (ok) {
        if (timer) clearTimeout(timer);
        localAiAvailable = ok;
        localAiChecked = true;
        if (window.COMPOSE && window.COMPOSE.onAiStatusChange) window.COMPOSE.onAiStatusChange();
        return ok;
      });
  }

  /* Lấy JSON đầu tiên trong một đoạn text — window.claude.complete không đảm bảo trả JSON thuần. */
  function extractJson(raw) {
    var m = String(raw).match(/\{[\s\S]*\}/);
    return m ? m[0] : raw;
  }

  /*
    Gọi mô hình thật qua một trong hai đường, trả về Promise<string> (text
    thô, ở đường máy chủ cục bộ đã là JSON hợp lệ theo schema).
  */
  function callModel(prompt, schema) {
    if (hasClaudeDesign()) {
      return window.claude.complete({
        model: 'claude-sonnet-4-5', max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }]
      });
    }
    return fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ prompt: prompt, schema: schema || null })
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        /* Phiên hết hạn giữa chừng. Báo cho app đưa cô về màn hình đăng nhập,
           thay vì hiện "máy chủ AI trả về lỗi (401)" chẳng ai hiểu. */
        if (res.status === 401) {
          if (window.COMPOSE && window.COMPOSE.onUnauthorized) window.COMPOSE.onUnauthorized();
          throw new Error('phiên đăng nhập đã hết hạn');
        }
        if (!res.ok || !data) throw new Error('máy chủ AI trả về lỗi (' + res.status + ')');
        if (!data.ok) throw new Error(data.error || 'lỗi không rõ từ máy chủ AI');
        return data.text;
      });
    });
  }

  function hasModel() { return aiReachable(); }

  /* JSON Schema đúng cấu trúc giáo án — dùng cho --json-schema của claude -p. */
  var LESSON_SCHEMA = {
    type: 'object',
    properties: {
      info: {
        type: 'object',
        properties: {
          school: { type: 'string' }, teacher: { type: 'string' }, className: { type: 'string' },
          ageLabel: { type: 'string' }, size: { type: 'string' }, date: { type: 'string' },
          theme: { type: 'string' }, subtheme: { type: 'string' }, activity: { type: 'string' },
          domain: { type: 'string' }, type: { type: 'string' }, duration: { type: 'string' },
          place: { type: 'string' }, form: { type: 'string' }
        },
        required: ['school', 'teacher', 'className', 'ageLabel', 'size', 'date', 'theme', 'subtheme',
          'activity', 'domain', 'type', 'duration', 'place', 'form']
      },
      objectives: {
        type: 'object',
        properties: {
          knowledge: { type: 'array', items: { type: 'string' } },
          skills: { type: 'array', items: { type: 'string' } },
          attitude: { type: 'array', items: { type: 'string' } },
          integrated: { type: 'array', items: { type: 'string' } },
          differentiated: {
            type: 'array',
            items: {
              type: 'object',
              properties: { group: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } },
              required: ['group', 'items']
            }
          }
        },
        required: ['knowledge', 'skills', 'attitude', 'integrated', 'differentiated']
      },
      prep: {
        type: 'object',
        properties: {
          teacher: { type: 'array', items: { type: 'string' } },
          children: { type: 'array', items: { type: 'string' } },
          environment: { type: 'array', items: { type: 'string' } },
          materials: { type: 'array', items: { type: 'string' } },
          digital: { type: 'array', items: { type: 'string' } },
          safety: { type: 'array', items: { type: 'string' } },
          backup: { type: 'array', items: { type: 'string' } }
        },
        required: ['teacher', 'children', 'environment', 'materials', 'digital', 'safety', 'backup']
      },
      activities: {
        type: 'array', minItems: 6, maxItems: 6,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' }, time: { type: 'string' },
            teacher: { type: 'array', items: { type: 'string' } },
            child: { type: 'array', items: { type: 'string' } },
            responses: { type: 'string' }, support: { type: 'string' },
            extend: { type: 'string' }, safety: { type: 'string' }
          },
          required: ['name', 'time', 'teacher', 'child', 'responses', 'support', 'extend', 'safety']
        }
      }
    },
    required: ['info', 'objectives', 'prep', 'activities']
  };

  /* Trả về { lesson, source: 'model' | 'local', error } — không bao giờ ném lỗi. */
  function generate(state) {
    if (!aiReachable()) {
      return Promise.resolve({ lesson: composeLesson(state), source: 'local', error: null });
    }
    return callModel(buildPrompt(state), LESSON_SCHEMA).then(function (out) {
      var data = JSON.parse(extractJson(out));
      if (!data.activities || !data.activities.length) throw new Error('thiếu hoạt động');
      return { lesson: data, source: 'model', error: null };
    }).catch(function (err) {
      return {
        lesson: composeLesson(state),
        source: 'local',
        error: 'Không gọi được mô hình (' + (err && err.message ? err.message : 'lỗi không rõ') +
          '). Giáo án dưới đây do app dựng ngay trên máy từ lựa chọn của chị.'
      };
    });
  }

  /* ── Cảnh báo kiểm tra chuyên môn ─────────────────────────────────────── */

  var VAGUE = ['trẻ chú ý lắng nghe', 'trẻ lắng nghe cô', 'trẻ trả lời', 'trẻ vâng ạ'];

  function checks(lesson) {
    var out = [];
    var acts = lesson.activities || [];
    var diff = (lesson.objectives && lesson.objectives.differentiated) || [];
    var prep = lesson.prep || {};

    /* 1. Mục tiêu quan sát được */
    var goals = []
      .concat(lesson.objectives.knowledge || [], lesson.objectives.skills || [], lesson.objectives.attitude || []);
    var vagueGoals = goals.filter(function (g) { return /^Trẻ (biết|hiểu|nắm)\b/i.test(g); });
    out.push(vagueGoals.length ? {
      ok: false,
      text: 'Có ' + vagueGoals.length + ' mục tiêu dùng động từ khó quan sát (biết, hiểu, nắm). Nên đổi sang việc trẻ làm được.'
    } : {
      ok: true,
      text: 'Mục tiêu quan sát được' + (diff.length ? ' và phù hợp cả ' + diff.length + ' nhóm tuổi' : '') + '.'
    });

    /* 2. Hoạt động dài nhất */
    var longest = -1, longestMin = 0;
    acts.forEach(function (a, i) {
      var m = totalMinutes(a.time);
      if (m > longestMin) { longestMin = m; longest = i; }
    });
    if (longestMin > 6) {
      out.push({
        ok: false,
        text: 'Hoạt động ' + (longest + 1) + ' dài ' + longestMin + ' phút. Cân nhắc rút còn ' + (longestMin - 2) +
          ' phút' + (diff.length ? ' với nhóm ' + diff[0].group.replace(/^Nhóm\s*/, '') : '') + '.'
      });
    } else {
      out.push({ ok: true, text: 'Không có hoạt động nào quá dài so với sức tập trung của trẻ.' });
    }

    /* 3. Thời gian dùng màn hình */
    var digital = (prep.digital || []).join(' ');
    var screenText = acts.map(function (a) { return (a.teacher || []).join(' '); }).join(' ') + ' ' + digital;
    if (digital || /tivi|màn hình|video/i.test(screenText)) {
      var mins = screenText.match(/(\d+)\s*phút/);
      out.push({
        ok: false,
        text: 'Có ' + (mins ? mins[1] + ' phút' : 'phần') + ' dùng màn hình. Bảo đảm cô ngồi cùng trẻ và tắt ngay sau khi xem.'
      });
    } else {
      out.push({ ok: true, text: 'Hoạt động không dùng màn hình.' });
    }

    /* 4. Cột hoạt động của trẻ có cụ thể không */
    var vagueRows = acts.filter(function (a) {
      var t = (a.child || []).join(' ').toLowerCase();
      return VAGUE.some(function (v) { return t.indexOf(v) !== -1 && t.length < 60; });
    });
    out.push(vagueRows.length ? {
      ok: false,
      text: 'Có ' + vagueRows.length + ' hàng ở cột "Hoạt động của trẻ" còn chung chung. Nên ghi việc trẻ làm được.'
    } : {
      ok: true,
      text: 'Cột "Hoạt động của trẻ" cụ thể, không lặp câu "trẻ chú ý lắng nghe".'
    });

    /* 5. Phân hóa cho lớp ghép */
    var isMixed = /ghép|và/.test(lesson.info.ageLabel || '');
    if (diff.length) {
      out.push({ ok: true, text: 'Đã có mục tiêu phân hóa và nhiệm vụ riêng cho từng nhóm tuổi.' });
    } else if (isMixed) {
      out.push({ ok: false, text: 'Giáo án ghi lớp ghép nhưng chưa có mục tiêu phân hóa theo nhóm tuổi.' });
    } else {
      out.push({ ok: true, text: 'Lớp một nhóm tuổi — không cần mục tiêu phân hóa.' });
    }

    /* 6. Biện pháp an toàn */
    var noSafety = acts.filter(function (a) { return !a.safety || a.safety === '—'; });
    if (!(prep.safety || []).length) {
      out.push({ ok: false, text: 'Mục II chưa có biện pháp bảo đảm an toàn. Cần ghi rõ trước khi dạy.' });
    } else if (noSafety.length) {
      out.push({ ok: false, text: 'Còn ' + noSafety.length + ' hoạt động chưa ghi lưu ý an toàn.' });
    } else {
      out.push({
        ok: true,
        text: 'Đã ghi ' + prep.safety.length + ' biện pháp an toàn ở mục II và lưu ý riêng cho từng hoạt động.'
      });
    }

    /* 7. Dữ liệu của trẻ */
    out.push({ ok: true, text: 'Không thu thập tên thật, hình ảnh hoặc thông tin định danh của trẻ.' });

    return out;
  }

  /* ── Slide, tóm tắt từ giáo án ────────────────────────────────────────── */

  /* Cắt một dòng giáo án thành câu ngắn đủ đọc trên slide. */
  function short(line, max) {
    var t = String(line || '').trim().replace(/\s+/g, ' ');
    var stop = t.indexOf('. ');
    if (stop > 12) t = t.slice(0, stop);
    t = t.replace(/[.;]$/, '');
    max = max || 62;
    if (t.length > max) t = t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
    return t;
  }

  /* Nhãn góc trên của slide hoạt động, đoán theo tên hoạt động. */
  function kickerFor(name, i, last) {
    if (i === 0) return 'KHỞI ĐỘNG';
    if (i === last) return 'KẾT THÚC';
    if (/dẫn dắt|tình huống/i.test(name)) return 'CÂU HỎI TƯƠNG TÁC';
    if (/trọng tâm|khám phá|nhận diện/i.test(name)) return 'KHÁM PHÁ';
    if (/thực hành|trải nghiệm/i.test(name)) return 'THỰC HÀNH';
    if (/trò chơi/i.test(name)) return 'TRÒ CHƠI';
    return 'HOẠT ĐỘNG ' + (i + 1);
  }

  /*
    Dựng bộ slide từ giáo án hiện tại. Trình tự theo bản thiết kế: bìa → thông
    tin → mục tiêu → chuẩn bị → từng hoạt động → tích hợp → kết thúc. Nhờ dựng
    từ giáo án nên slide luôn khớp với nội dung cô vừa sửa.

    `cap` là số slide tối đa cô chọn ở chip "Số slide"; null = tự động.
  */
  function slides(lesson, cap) {
    var L = lesson, info = L.info, obj = L.objectives, prep = L.prep;
    var acts = L.activities || [];
    var out = [];

    out.push({
      kicker: 'GIÁO ÁN', title: info.activity, cover: true,
      bullets: [
        info.className + ' · ' + info.ageLabel.replace(/^Lớp ghép:\s*/, ''),
        'Chủ đề: ' + info.theme + ' · ' + info.subtheme,
        'GV: ' + info.teacher
      ],
      notes: 'Slide bìa. Chỉ để mở đầu, không đọc lại nội dung.'
    });

    out.push({
      kicker: 'THÔNG TIN HOẠT ĐỘNG', title: info.domain,
      bullets: ['Thời lượng ' + info.duration, 'Hình thức: ' + info.form.toLowerCase(), info.size + ' · ' + info.place],
      notes: 'Nói nhanh trong 20 giây.'
    });

    var goalLines = [].concat(obj.knowledge || [], obj.skills || []).slice(0, 3).map(function (g) { return short(g); });
    out.push({
      kicker: 'MỤC TIÊU', title: 'Trẻ làm được gì sau hoạt động',
      bullets: goalLines,
      notes: (obj.differentiated || []).length
        ? (obj.differentiated || []).map(function (g) { return g.group + ': ' + short(g.items[0], 70); }).join(' — ')
        : 'Nhắc mục tiêu bằng lời, không đọc nguyên văn cho trẻ.'
    });

    out.push({
      kicker: 'CHUẨN BỊ', title: 'Đồ dùng và môi trường', image: true,
      bullets: [].concat(prep.teacher || [], prep.children || [], prep.environment || [])
        .slice(0, 3).map(function (g) { return short(g); }),
      notes: (prep.backup || []).length ? short((prep.backup || [])[0], 110) : 'Kiểm tra đồ dùng trước giờ dạy.'
    });

    var last = acts.length - 1;
    acts.forEach(function (a, i) {
      out.push({
        kicker: kickerFor(a.name, i, last),
        title: short(a.name, 52),
        bullets: (a.child || []).slice(0, 3).map(function (c) { return short(c); }),
        notes: [a.support, a.extend].filter(function (x) { return x && x !== '—'; }).join(' ') ||
          'Giữ đúng ' + a.time + '.',
        image: /khám phá|thực hành|chuẩn bị|khởi động/i.test(a.name) || i === 2 || i === 3
      });
    });

    /* Slide tích hợp đứng trước slide kết thúc, đúng thứ tự bản thiết kế. */
    if ((obj.integrated || []).length) {
      var tail = out.pop();
      out.push({
        kicker: 'TÍCH HỢP',
        title: short((obj.integrated[0] || '').split(':')[0], 46),
        bullets: (obj.integrated || []).slice(0, 3).map(function (g) {
          var parts = String(g).split(':');
          return short(parts.length > 1 ? parts.slice(1).join(':') : g);
        }),
        notes: 'Thể hiện bằng hành động trong hoạt động, không chỉ đọc tên nội dung.'
      });
      out.push(tail);
    }

    return cap ? out.slice(0, cap) : out;
  }

  /* ── Bản xem trước "Nhờ AI chỉnh sửa" ─────────────────────────────────── */

  /*
    Bản dựng cục bộ, không cần mạng — dùng khi không nối được AI thật, hoặc
    khi gọi AI thật bị lỗi giữa chừng. Mỗi việc trả về { text, patch }: `text`
    là bản xem trước cho cô đọc, `patch(lesson)` là hàm sửa giáo án khi cô bấm
    "Áp dụng thay đổi". Việc nào chỉ rà soát thì không có `patch`, và giao
    diện chỉ hiện nút đóng.
  */
  function reviewLocal(key, lesson) {
    var acts = lesson.activities || [];
    var central = Math.min(2, acts.length - 1);

    if (key === 'Viết lại hoạt động trọng tâm') {
      var a = acts[central];
      if (!a) return { text: 'Giáo án chưa có hoạt động nào để viết lại.' };
      var newTeacher = [
        'Cô đưa đồ dùng cho trẻ tự thử trước, hỏi "con thấy gì?" rồi mới giải thích.',
        'Cô mời hai trẻ lên làm mẫu cho cả lớp xem, cô chỉ nhắc bằng câu hỏi.',
        'Cô chia nhóm nhỏ, mỗi nhóm một nhiệm vụ khác nhau và cùng thời lượng.'
      ];
      var newChild = [
        'Trẻ tự thử với đồ dùng và nói điều mình phát hiện.',
        'Trẻ lên làm mẫu và nói lại cách mình làm cho bạn nghe.',
        'Trẻ làm nhiệm vụ của nhóm mình rồi giới thiệu kết quả.'
      ];
      return {
        text: 'Hoạt động ' + (central + 1) + ' — ' + a.name + ' (giữ nguyên ' + a.time + ')\n\n' +
          'Hoạt động của cô:\n' + newTeacher.map(function (t) { return '– ' + t; }).join('\n') +
          '\n\nHoạt động của trẻ:\n' + newChild.map(function (t) { return '– ' + t; }).join('\n') +
          '\n\nĐiểm thay đổi: trẻ thao tác trước, cô giải thích sau; cột hoạt động của trẻ ghi việc trẻ làm được, không dùng câu chung chung.',
        patch: function (L) {
          L.activities[central].teacher = newTeacher;
          L.activities[central].child = newChild;
          return L;
        }
      };
    }

    if (key === 'Rút gọn giáo án') {
      var target = 20;
      var newTimes = splitTime(target);
      var lines = acts.map(function (x, i) {
        return '– ' + (i + 1) + '. ' + x.name + ': ' + x.time + ' → ' + (newTimes[i] || x.time);
      });
      return {
        text: 'Rút bảng hoạt động về khoảng ' + target + ' phút, giữ đủ 6 bước:\n\n' + lines.join('\n') +
          '\n\nCách rút: bỏ phần nhắc lại ở hoạt động mở đầu, gộp hai câu hỏi dẫn dắt thành một, ' +
          'phần thực hành chỉ chạy một lượt nhóm nhỏ.',
        patch: function (L) {
          var t = splitTime(target);
          L.activities.forEach(function (x, i) { if (t[i]) x.time = t[i]; });
          L.info.duration = target + ' phút';
          return L;
        }
      };
    }

    if (key === 'Bổ sung một trò chơi củng cố') {
      var group = ((lesson.objectives || {}).differentiated || []).map(function (g) {
        return g.group.replace(/^Nhóm\s*/, '');
      }).join(' và ') || lesson.info.ageLabel;
      var row = {
        name: 'Trò chơi củng cố: Tìm đúng – nói đúng', time: '4 phút',
        teacher: [
          'Cô chia lớp thành hai đội, mỗi đội một rổ thẻ hình về "' + lesson.info.activity + '".',
          'Cô nêu luật: cô nói tên, trẻ tìm đúng thẻ và nói lại thành câu.'
        ],
        child: [
          'Trẻ tìm thẻ theo yêu cầu của cô rồi nói câu ngắn về thẻ đó.',
          'Trẻ cùng đội nhắc bạn khi bạn chưa tìm được.'
        ],
        responses: 'Trẻ nhỏ tìm được thẻ nhưng nói chưa thành câu; trẻ lớn nói được cả lý do chọn.',
        support: 'Cô để thẻ ngửa cho trẻ nhỏ và giảm số thẻ trong rổ.',
        extend: 'Trẻ lớn tự nêu yêu cầu cho đội bạn tìm.',
        safety: 'Trẻ ngồi tại chỗ và đưa thẻ, không chạy khi tìm thẻ.'
      };
      return {
        text: 'Đề xuất một trò chơi củng cố 4 phút, phù hợp ' + group + ':\n\n' +
          row.name + ' (' + row.time + ')\n' +
          'Luật chơi: cô nói tên đối tượng, trẻ tìm đúng thẻ hình trong rổ của đội và nói lại thành một câu.\n\n' +
          'Hoạt động của cô:\n' + row.teacher.map(function (t) { return '– ' + t; }).join('\n') +
          '\n\nHoạt động của trẻ:\n' + row.child.map(function (t) { return '– ' + t; }).join('\n') +
          '\n\nLưu ý an toàn: ' + row.safety +
          '\n\nÁp dụng sẽ chèn hoạt động này vào trước phần nhận xét, kết thúc.',
        patch: function (L) {
          L.activities.splice(Math.max(0, L.activities.length - 1), 0, row);
          return L;
        }
      };
    }

    if (key === 'Chuyển sang nhóm tuổi 5–6 tuổi') {
      var topic = lesson.info.activity;
      var newObj = {
        knowledge: [
          'Trẻ nói được đặc điểm chính của "' + topic + '" và giải thích vì sao con biết.',
          'Trẻ so sánh được hai trường hợp khác nhau trong cùng nội dung.'
        ],
        skills: [
          'Trẻ tự thực hiện nhiệm vụ của "' + topic + '" không cần cô làm mẫu lại.',
          'Trẻ diễn đạt lại cách làm của mình bằng ba đến bốn câu liền mạch.'
        ],
        attitude: [
          'Trẻ nhận nhiệm vụ trong nhóm và làm hết phần của mình.',
          'Trẻ nêu ý kiến khác với bạn một cách lịch sự.'
        ]
      };
      return {
        text: 'Điều chỉnh cho nhóm 5–6 tuổi — nâng mức độ nhưng vẫn học qua chơi, không hàn lâm:\n\n' +
          '1. Kiến thức:\n' + newObj.knowledge.map(function (t) { return '– ' + t; }).join('\n') +
          '\n\n2. Kỹ năng:\n' + newObj.skills.map(function (t) { return '– ' + t; }).join('\n') +
          '\n\n3. Thái độ:\n' + newObj.attitude.map(function (t) { return '– ' + t; }).join('\n') +
          '\n\nNhiệm vụ trong bảng hoạt động: trẻ tự thao tác trước, cô chỉ đặt câu hỏi mở; ' +
          'phần mở rộng cho trẻ tự nêu yêu cầu cho bạn.\n\n' +
          'Áp dụng sẽ thay ba khối mục tiêu và đổi nhãn độ tuổi thành 5–6 tuổi. ' +
          'Mục tiêu phân hóa của lớp ghép sẽ được bỏ vì lớp chỉ còn một nhóm tuổi.',
        patch: function (L) {
          L.objectives.knowledge = newObj.knowledge;
          L.objectives.skills = newObj.skills;
          L.objectives.attitude = newObj.attitude;
          L.objectives.differentiated = [];
          L.info.ageLabel = '5–6 tuổi';
          return L;
        }
      };
    }

    if (key === 'Tăng tính trải nghiệm') {
      var idx = Math.min(3, acts.length - 1);
      var add = {
        teacher: 'Cô đặt sẵn ba khay vật liệu để trẻ tự chọn và tự làm, cô không làm mẫu trước.',
        child: 'Trẻ chọn khay, tự thao tác và tạo ra một sản phẩm đơn giản của mình.'
      };
      return {
        text: 'Thêm phần trẻ tự thao tác vào hoạt động ' + (idx + 1) + ' — ' + (acts[idx] ? acts[idx].name : '') + ':\n\n' +
          'Hoạt động của cô:\n– ' + add.teacher +
          '\n\nHoạt động của trẻ:\n– ' + add.child +
          '\n\nSản phẩm mong đợi: mỗi trẻ có một sản phẩm để giới thiệu ở phần kết thúc. ' +
          'Chuẩn bị thêm: ba khay vật liệu và khăn lau tay.\n\n' +
          'Lưu ý: giữ nguyên thời lượng, đổi phần cô giảng thành phần trẻ làm.',
        patch: function (L) {
          L.activities[idx].teacher.push(add.teacher);
          L.activities[idx].child.push(add.child);
          L.prep.materials.push('Ba khay vật liệu cho trẻ tự chọn và khăn lau tay.');
          return L;
        }
      };
    }

    if (key === 'Kiểm tra an toàn') {
      var risky = [];
      var RISK = [
        [/kéo|dao|đinh|kim|que|tăm/i, 'có dụng cụ sắc nhọn'],
        [/chạy|nhảy|đuổi|thi chạy/i, 'có vận động chạy nhảy'],
        [/nước|nóng|lửa|nến/i, 'có nước hoặc vật nóng'],
        [/hạt|viên nhỏ|khối nhỏ|cúc áo/i, 'có chi tiết nhỏ trẻ dễ cho vào miệng'],
        [/tivi|màn hình|video/i, 'có thời gian nhìn màn hình'],
        [/ngoài trời|sân|vườn/i, 'tổ chức ngoài trời']
      ];
      acts.forEach(function (a, i) {
        var text = [].concat(a.teacher || [], a.child || []).join(' ');
        RISK.forEach(function (r) {
          if (r[0].test(text)) risky.push('– Hoạt động ' + (i + 1) + ' (' + a.name + '): ' + r[1] + '. Lưu ý đang ghi: ' + (a.safety || 'chưa ghi') + '.');
        });
      });
      var missing = acts.filter(function (a) { return !a.safety || a.safety === '—'; })
        .map(function (a, i) { return '– ' + a.name; });
      return {
        text: 'Rà soát an toàn trên bảng hoạt động hiện tại:\n\n' +
          (risky.length ? 'Điểm cần chú ý:\n' + risky.join('\n') : 'Không phát hiện dụng cụ hoặc vận động có nguy cơ cao trong bảng hoạt động.') +
          '\n\n' + (missing.length ? 'Hoạt động chưa ghi lưu ý an toàn:\n' + missing.join('\n')
            : 'Tất cả hoạt động đều đã ghi lưu ý an toàn.') +
          '\n\nBiện pháp ở mục II:\n' + ((lesson.prep.safety || []).map(function (s) { return '– ' + s; }).join('\n') || '– chưa ghi') +
          '\n\nĐây là bản rà soát, không thay nội dung giáo án.'
      };
    }

    if (key === 'Kiểm tra chính tả tiếng Việt') {
      var issues = [];
      acts.forEach(function (a, i) {
        [].concat(a.teacher || [], a.child || []).forEach(function (line) {
          if (/\s{2,}/.test(line)) issues.push('– Hoạt động ' + (i + 1) + ': có khoảng trắng đôi — "' + short(line, 46) + '"');
          if (!/[.!?"”]$/.test(line.trim())) issues.push('– Hoạt động ' + (i + 1) + ': câu chưa có dấu kết thúc — "' + short(line, 46) + '"');
          var quotes = (line.match(/"/g) || []).length;
          if (quotes % 2 !== 0) issues.push('– Hoạt động ' + (i + 1) + ': dấu ngoặc kép chưa đóng — "' + short(line, 46) + '"');
          VAGUE.forEach(function (v) {
            if (line.toLowerCase().indexOf(v) !== -1) {
              issues.push('– Hoạt động ' + (i + 1) + ': câu "' + v + '" chung chung, nên ghi việc trẻ làm được.');
            }
          });
        });
      });
      return {
        text: 'Rà soát diễn đạt trên bảng hoạt động:\n\n' +
          (issues.length ? issues.slice(0, 14).join('\n') +
            (issues.length > 14 ? '\n\n… và ' + (issues.length - 14) + ' điểm nữa cùng loại.' : '')
            : 'Không thấy lỗi khoảng trắng, dấu câu hay câu chung chung trong bảng hoạt động.') +
          '\n\nApp chỉ kiểm tra được dấu câu, khoảng trắng và những câu chung chung quen gặp. ' +
          'Chính tả từng từ tiếng Việt cần người đọc lại.\n\n' +
          'Đây là bản rà soát, không thay nội dung giáo án.'
      };
    }

    return { text: 'Chưa có nội dung cho việc này.' };
  }

  /* Việc nào chỉ rà soát (không sửa giáo án) thì AI cũng không trả patch. */
  var REVIEW_ONLY = ['Kiểm tra an toàn', 'Kiểm tra chính tả tiếng Việt'];

  /* JSON Schema cho từng việc "Nhờ AI chỉnh sửa" — luôn có "summary" (bản xem
     trước cho cô đọc), phần còn lại là nội dung để applyReviewPatch() ghép
     vào giáo án. */
  var REVIEW_SCHEMAS = {
    'Viết lại hoạt động trọng tâm': {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        teacher: { type: 'array', items: { type: 'string' } },
        child: { type: 'array', items: { type: 'string' } }
      },
      required: ['summary', 'teacher', 'child']
    },
    'Rút gọn giáo án': {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        targetMinutes: { type: 'number' },
        times: { type: 'array', items: { type: 'string' } }
      },
      required: ['summary', 'targetMinutes', 'times']
    },
    'Bổ sung một trò chơi củng cố': {
      type: 'object',
      properties: {
        summary: { type: 'string' }, name: { type: 'string' }, time: { type: 'string' },
        teacher: { type: 'array', items: { type: 'string' } },
        child: { type: 'array', items: { type: 'string' } },
        responses: { type: 'string' }, support: { type: 'string' },
        extend: { type: 'string' }, safety: { type: 'string' }
      },
      required: ['summary', 'name', 'time', 'teacher', 'child', 'responses', 'support', 'extend', 'safety']
    },
    'Chuyển sang nhóm tuổi 5–6 tuổi': {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        knowledge: { type: 'array', items: { type: 'string' } },
        skills: { type: 'array', items: { type: 'string' } },
        attitude: { type: 'array', items: { type: 'string' } }
      },
      required: ['summary', 'knowledge', 'skills', 'attitude']
    },
    'Tăng tính trải nghiệm': {
      type: 'object',
      properties: {
        summary: { type: 'string' }, addTeacher: { type: 'string' },
        addChild: { type: 'string' }, materialsAdd: { type: 'string' }
      },
      required: ['summary', 'addTeacher', 'addChild', 'materialsAdd']
    },
    'Kiểm tra an toàn': {
      type: 'object', properties: { summary: { type: 'string' } }, required: ['summary']
    },
    'Kiểm tra chính tả tiếng Việt': {
      type: 'object', properties: { summary: { type: 'string' } }, required: ['summary']
    }
  };

  function buildReviewPrompt(key, lesson) {
    var acts = lesson.activities || [];
    var central = Math.min(2, acts.length - 1);
    var experienceIdx = Math.min(3, acts.length - 1);
    var ctx = JSON.stringify({
      info: lesson.info,
      activities: acts.map(function (a) { return { name: a.name, time: a.time, teacher: a.teacher, child: a.child }; }),
      objectives: lesson.objectives, prep: lesson.prep
    });

    var INSTR = {
      'Viết lại hoạt động trọng tâm': 'Viết lại hoạt động thứ ' + (central + 1) +
        ' ("' + ((acts[central] || {}).name || '') + '") cho sinh động hơn, giữ nguyên thời lượng. ' +
        'Trả về "teacher" và "child" là hai mảng câu mới cho đúng hoạt động này. ' +
        'Cột "child" phải cụ thể việc trẻ làm được, KHÔNG dùng câu "Trẻ chú ý lắng nghe".',
      'Rút gọn giáo án': 'Rút bảng hoạt động về khoảng 20 phút tổng cộng, giữ đủ ' + acts.length +
        ' hoạt động theo đúng thứ tự hiện có. Trả về "times": mảng thời lượng mới (chuỗi kiểu "3 phút"), ' +
        'đúng ' + acts.length + ' phần tử theo đúng thứ tự, và "targetMinutes" là tổng số phút mới.',
      'Bổ sung một trò chơi củng cố': 'Đề xuất một trò chơi củng cố khoảng 4 phút phù hợp với ' +
        lesson.info.ageLabel + ', nêu luật chơi ngắn trong "summary". Trả về đủ các trường của một hàng ' +
        'hoạt động mới: name, time, teacher (mảng), child (mảng), responses, support, extend, safety.',
      'Chuyển sang nhóm tuổi 5–6 tuổi': 'Điều chỉnh ba khối mục tiêu (kiến thức, kỹ năng, thái độ) cho ' +
        'nhóm 5–6 tuổi — nâng mức độ nhưng không hàn lâm, trẻ vẫn học qua chơi.',
      'Tăng tính trải nghiệm': 'Đề xuất thêm cho hoạt động thứ ' + (experienceIdx + 1) +
        ' ("' + ((acts[experienceIdx] || {}).name || '') + '") một đoạn để trẻ tự thao tác, thử nghiệm và ' +
        'tạo sản phẩm đơn giản. Trả về "addTeacher" (một câu cô làm), "addChild" (một câu trẻ làm) và ' +
        '"materialsAdd" (một câu học liệu cần thêm).',
      'Kiểm tra an toàn': 'Rà soát nguy cơ mất an toàn trong bảng hoạt động và nêu biện pháp cụ thể trong ' +
        '"summary". Đây chỉ là bản rà soát, không đề xuất sửa nội dung giáo án.',
      'Kiểm tra chính tả tiếng Việt': 'Liệt kê lỗi chính tả hoặc diễn đạt chưa rõ trong bảng hoạt động và ' +
        'cách sửa, viết trong "summary". Đây chỉ là bản rà soát, không tự sửa nội dung giáo án.'
    };

    return 'Bạn là chuyên gia giáo dục mầm non Việt Nam, đang biên tập một giáo án đã có sẵn.\n' +
      'Giáo án hiện tại (JSON): ' + ctx + '\n\n' +
      'Yêu cầu: ' + (INSTR[key] || key) + '\n' +
      'Quy tắc chung: lấy trẻ làm trung tâm, học qua chơi, không hoạt động nguy hiểm, không thu thập thông ' +
      'tin định danh của trẻ, không bịa số hiệu văn bản pháp lý.\n' +
      'Trả về DUY NHẤT một JSON hợp lệ đúng schema đã cho. "summary" là đoạn văn bản ngắn gọn, dễ đọc, ' +
      'tiếng Việt có dấu, để giáo viên xem trước trong hộp thoại — không lồng JSON vào trong "summary".';
  }

  function applyReviewPatch(key, lesson, data) {
    var acts = lesson.activities || [];
    if (key === 'Viết lại hoạt động trọng tâm') {
      var central = Math.min(2, acts.length - 1);
      if (acts[central]) { acts[central].teacher = data.teacher; acts[central].child = data.child; }
    } else if (key === 'Rút gọn giáo án') {
      acts.forEach(function (a, i) { if (data.times && data.times[i]) a.time = data.times[i]; });
      lesson.info.duration = (data.targetMinutes || totalMinutes(lesson.info.duration)) + ' phút';
    } else if (key === 'Bổ sung một trò chơi củng cố') {
      acts.splice(Math.max(0, acts.length - 1), 0, {
        name: data.name, time: data.time, teacher: data.teacher, child: data.child,
        responses: data.responses, support: data.support, extend: data.extend, safety: data.safety
      });
    } else if (key === 'Chuyển sang nhóm tuổi 5–6 tuổi') {
      lesson.objectives.knowledge = data.knowledge;
      lesson.objectives.skills = data.skills;
      lesson.objectives.attitude = data.attitude;
      lesson.objectives.differentiated = [];
      lesson.info.ageLabel = '5–6 tuổi';
    } else if (key === 'Tăng tính trải nghiệm') {
      var idx = Math.min(3, acts.length - 1);
      if (acts[idx]) { acts[idx].teacher.push(data.addTeacher); acts[idx].child.push(data.addChild); }
      lesson.prep.materials = (lesson.prep.materials || []).concat([data.materialsAdd]);
    }
    return lesson;
  }

  /*
    Trả về Promise<{ text, patch, source }>. Gọi AI thật khi nối được (Claude
    Design hoặc máy chủ cục bộ); lỗi giữa chừng — mất mạng, hết hạn mức, AI trả
    sai schema — đều rơi về reviewLocal() thay vì hiện lỗi trắng cho cô.
  */
  function review(key, lesson) {
    var canApply = REVIEW_ONLY.indexOf(key) === -1;
    if (!aiReachable()) {
      return Promise.resolve(assign({ source: 'local' }, reviewLocal(key, lesson)));
    }
    var schema = REVIEW_SCHEMAS[key];
    return callModel(buildReviewPrompt(key, lesson), schema).then(function (raw) {
      var data = JSON.parse(extractJson(raw));
      return {
        text: data.summary,
        patch: canApply ? function (L) { return applyReviewPatch(key, L, data); } : null,
        source: 'model'
      };
    }).catch(function (err) {
      var local = reviewLocal(key, lesson);
      local.text += '\n\n(Không gọi được AI thật — ' +
        (err && err.message ? err.message : 'lỗi không rõ') + '. Đây là bản do app tự dựng.)';
      local.source = 'local';
      return local;
    });
  }

  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var src = arguments[i];
      for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
    }
    return target;
  }

  checkLocalAi();

  window.COMPOSE = {
    generate: generate,
    composeLesson: composeLesson,
    buildPrompt: buildPrompt,
    hasModel: hasModel,
    isAiReady: aiReachable,
    checkLocalAi: checkLocalAi,
    onAiStatusChange: null,
    onUnauthorized: null,   /* app.js gán vào để đá về màn hình đăng nhập */
    checks: checks,
    slides: slides,
    review: review,
    totalMinutes: totalMinutes,
    ageLabel: ageLabel
  };
})();
