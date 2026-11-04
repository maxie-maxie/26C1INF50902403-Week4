(function () {
  'use strict';

  const legacyRoot = document.getElementById('viewLegacy');
  if (!legacyRoot) return;

  const $ = function (id) {
    return legacyRoot.querySelector('#' + id);
  };

  const stagesRemote = [
    { title: '1. Xác định đích đến', desc: 'Laptop cần truy cập máy chủ mô phỏng ở Hà Nội. Hệ điều hành so sánh IP đích với subnet cục bộ 192.168.10.0/24.', items: ['IP nguồn: 192.168.10.25/24', 'IP đích: 203.0.113.80', 'Đích nằm ngoài subnet nên không gửi frame trực tiếp đến máy chủ ở xa.'], call: 'IP xác định đích ở tầng mạng. Bước tiếp theo là xác định nút kế tiếp trên liên kết cục bộ.', focus: ['node-laptop', 'node-server'], edges: [], packet: null, table: [['IP nguồn', '192.168.10.25'], ['IP đích', '203.0.113.80'], ['MAC đích ở chặng đầu', 'Chưa phân giải'], ['Next hop', '192.168.10.1 (gateway)']] },
    { title: '2. Chọn default gateway', desc: 'Vì máy chủ không thuộc subnet cục bộ, laptop cần gửi datagram đến router gateway 192.168.10.1.', items: ['Kiểm tra ARP cache xem đã biết MAC gateway chưa.', 'Nếu chưa có ánh xạ hợp lệ, laptop cần gửi ARP Request.', 'ARP tìm MAC của gateway — không tìm MAC của máy chủ ở Hà Nội.'], call: 'Câu hỏi thứ hai: gửi cho ai trên liên kết hiện tại? Đáp án là gateway.', focus: ['node-laptop', 'node-gw'], edges: ['e-lan', 'e-gw'], packet: [200, 184], table: [['IP nguồn', '192.168.10.25'], ['IP đích', '203.0.113.80'], ['IP cần phân giải bằng ARP', '192.168.10.1'], ['ARP cache', 'Chưa có mục phù hợp']] },
    { title: '3. ARP Request — phát câu hỏi trong LAN', desc: 'Laptop phát một Ethernet frame broadcast mang ARP Request: “Ai có IPv4 192.168.10.1? Hãy cho tôi biết MAC”.', items: ['Switch / Access Point chuyển frame trong miền liên kết tương ứng.', 'Các thiết bị nhận kiểm tra địa chỉ IPv4 đích được hỏi.', 'ARP Request thường dùng MAC broadcast FF:FF:FF:FF:FF:FF.'], call: 'Broadcast chỉ ở miền quảng bá cục bộ. Router không chuyển tiếp ARP broadcast như một gói IP thông thường.', focus: ['node-laptop', 'node-switch', 'node-gw'], edges: ['e-lan', 'e-gw'], packet: [350, 184], arp: true, table: [['Loại thông điệp', 'ARP Request'], ['Ethernet MAC đích', 'FF:FF:FF:FF:FF:FF'], ['Target protocol address', '192.168.10.1'], ['IP đích của datagram ứng dụng', 'Chưa gửi datagram ứng dụng']] },
    { title: '4. ARP Reply — gateway trả lời', desc: 'Gateway nhận thấy IP được hỏi chính là địa chỉ IPv4 trên giao diện LAN của mình, rồi phản hồi địa chỉ MAC tương ứng.', items: ['Ví dụ MAC gateway: CC:CC:CC:CC:CC:01.', 'Laptop lưu ánh xạ vào ARP cache theo chính sách hệ điều hành.', 'Sau khi có MAC gateway, laptop có thể đóng gói và gửi IP datagram.'], call: 'ARP Reply thường là unicast về máy yêu cầu. Bây giờ laptop biết gửi frame đầu tiên đến đâu.', focus: ['node-laptop', 'node-gw'], edges: ['e-gw'], packet: [460, 184], table: [['IPv4 gateway', '192.168.10.1'], ['MAC gateway (ví dụ)', 'CC:CC:CC:CC:CC:01'], ['ARP cache', '192.168.10.1 → CC:CC:CC:CC:CC:01'], ['IP đích của datagram', '203.0.113.80']] },
    { title: '5. Frame đầu tiên đi đến gateway', desc: 'Laptop gửi frame đến MAC của gateway. IP datagram ở bên trong vẫn có IP đích là máy chủ ở Hà Nội.', items: ['MAC nguồn: MAC giao diện Wi-Fi/Ethernet của laptop.', 'MAC đích: CC:CC:CC:CC:CC:01 (gateway trong ví dụ).', 'IP đích: 203.0.113.80 — không đổi thành IP gateway.'], call: 'Đây là sự khác nhau cốt lõi giữa địa chỉ MAC đích của frame và địa chỉ IP đích của datagram.', focus: ['node-laptop', 'node-switch', 'node-gw'], edges: ['e-lan', 'e-gw'], packet: [460, 184], table: [['Ethernet MAC nguồn', 'AA:AA:AA:AA:AA:25 (ví dụ)'], ['Ethernet MAC đích', 'CC:CC:CC:CC:CC:01'], ['IP nguồn', '192.168.10.25'], ['IP đích', '203.0.113.80']] },
    { title: '6. Router tra tuyến và chuyển tiếp qua nhiều mạng', desc: 'R1 bóc phần đóng gói tầng liên kết, xem IP đích và tra bảng chuyển tiếp. Mỗi router tiếp theo lại quyết định chặng kế tiếp.', items: ['R1 có thể gửi đến R2 theo tuyến đang được chọn.', 'Trên liên kết R1–R2, frame có MAC của hai giao diện thuộc chặng đó.', 'R2 và R3 tiếp tục tra bảng; MAC thay đổi theo từng liên kết trong ví dụ không có NAT.'], call: 'Routing xây dựng/chọn tuyến; forwarding thực hiện chuyển gói theo bảng chuyển tiếp. Một gói có thể đi qua nhiều router.', focus: ['node-gw', 'node-r2', 'node-r3'], edges: ['e-main1', 'e-main2'], packet: [630, 110], table: [['IP nguồn', '192.168.10.25'], ['IP đích', '203.0.113.80'], ['MAC đích trên chặng R1→R2', 'MAC giao diện R2 trên liên kết đó'], ['Quyết định', 'Tra bảng chuyển tiếp / next hop']] },
    { title: '7. Máy chủ nhận gói tin', desc: 'Sau khi các router chuyển tiếp qua những liên kết thích hợp, datagram đến mạng đích và máy chủ xử lý yêu cầu.', items: ['Các frame tầng liên kết được tạo lại theo từng chặng.', 'Trong ví dụ không có NAT, IP nguồn/đích thường được giữ nguyên xuyên tuyến.', 'Phản hồi từ máy chủ sẽ đi theo các quyết định định tuyến ở chiều ngược lại.'], call: 'Một lần mở ứng dụng thành công phụ thuộc vào nhiều thành phần phối hợp: IP, ARP, routing, forwarding và các dịch vụ mạng liên quan.', focus: ['node-server'], edges: ['e-main2', 'e-main3'], packet: [987, 184], table: [['Máy chủ đích', '203.0.113.80'], ['IP nguồn của datagram', '192.168.10.25'], ['MAC đích cuối cùng', 'MAC giao diện máy chủ trên LAN đích'], ['Kết quả', 'Máy chủ nhận và xử lý yêu cầu']] }
  ];

  const stagesLocal = [
    { title: '1. Xác định đích trong cùng subnet', desc: 'Trong kịch bản này, laptop gửi dữ liệu đến máy in B có IP 192.168.10.50/24. Cả hai cùng thuộc subnet 192.168.10.0/24.', items: ['IP nguồn: 192.168.10.25/24', 'IP đích: 192.168.10.50', 'Đích cùng subnet, nên laptop tìm MAC máy in B.'], call: 'Câu hỏi đầu tiên: đích ở đâu? Cả hai nằm trong mạng cục bộ.', focus: ['node-laptop', 'node-printer'], edges: ['e-lan'], table: [['IP nguồn', '192.168.10.25'], ['IP đích', '192.168.10.50'], ['Subnet nguồn', '192.168.10.0/24'], ['Next hop', 'Máy in B trên LAN']] },
    { title: '2. ARP tìm MAC của máy in', desc: 'Laptop kiểm tra ARP cache. Nếu chưa có ánh xạ phù hợp, nó gửi ARP Request hỏi ai có IP 192.168.10.50.', items: ['ARP Request phát trong miền broadcast cục bộ.', 'Máy in nhận yêu cầu nếu cùng miền liên kết và có thể phản hồi.', 'Không cần ARP qua gateway để tìm máy in trong cùng subnet.'], call: 'Khi đích cùng subnet, MAC đích của frame là MAC máy in, không phải MAC gateway.', focus: ['node-laptop', 'node-switch', 'node-printer'], edges: ['e-lan'], packet: [290, 184], arp: true, table: [['Loại thông điệp', 'ARP Request'], ['Target IPv4', '192.168.10.50'], ['Ethernet destination', 'Broadcast'], ['Đích cần tìm MAC', 'Máy in B']] },
    { title: '3. Máy in trả lời ARP', desc: 'Máy in phản hồi địa chỉ MAC của chính nó. Laptop có thể lưu ánh xạ vào ARP cache.', items: ['ARP Reply thường unicast về laptop.', 'Ví dụ MAC máy in: DD:DD:DD:DD:DD:50.', 'Laptop đã biết địa chỉ liên kết đích cần dùng.'], call: 'ARP phân giải IPv4 thành MAC cho giao tiếp cục bộ; đây không phải là thuật toán định tuyến.', focus: ['node-laptop', 'node-printer'], edges: ['e-lan'], packet: [290, 290], table: [['IPv4 máy in', '192.168.10.50'], ['MAC máy in (ví dụ)', 'DD:DD:DD:DD:DD:50'], ['ARP cache', '192.168.10.50 → DD:DD:DD:DD:DD:50'], ['Gateway có cần ở chặng đầu?', 'Không']] },
    { title: '4. Frame được gửi trực tiếp trong LAN', desc: 'Laptop đóng gói datagram trong frame có MAC đích là máy in. Router không cần chuyển tiếp gói này vì đích nằm cùng subnet.', items: ['MAC đích của frame: MAC máy in B.', 'IP đích: 192.168.10.50.', 'Switch chuyển frame đến cổng phù hợp theo bảng MAC.'], call: 'So sánh với kịch bản máy chủ ở Hà Nội: khác subnet thì MAC đích đầu tiên là gateway; cùng subnet thì MAC đích là thiết bị nhận.', focus: ['node-laptop', 'node-switch', 'node-printer'], edges: ['e-lan'], packet: [290, 290], table: [['Ethernet MAC nguồn', 'AA:AA:AA:AA:AA:25 (ví dụ)'], ['Ethernet MAC đích', 'DD:DD:DD:DD:DD:50'], ['IP nguồn', '192.168.10.25'], ['IP đích', '192.168.10.50']] },
    { title: '5. Thiết bị đích nhận dữ liệu', desc: 'Máy in nhận frame được gửi trong LAN và xử lý dữ liệu theo dịch vụ in ấn đang chạy.', items: ['Không cần tuyến qua R1 để tới máy in này.', 'Nếu không liên lạc được, hãy kiểm tra subnet, Wi-Fi/VLAN, ARP và bảng MAC của switch.', 'Cùng subnet là căn cứ theo cấu hình IP/subnet, không chỉ dựa vào địa điểm vật lý.'], call: 'Bài học: xác định đúng subnet trước, rồi mới quyết định cần phân giải MAC của ai.', focus: ['node-printer'], edges: ['e-lan'], packet: [290, 290], table: [['Đích', 'Máy in B'], ['IP đích', '192.168.10.50'], ['MAC đích', 'MAC của máy in'], ['Kết quả', 'Dữ liệu được gửi trên LAN']] }
  ];

  let step = 0;
  let failed = false;
  let autoTimer = null;
  let quizDone = false;
  let qi = 0;

  function stages() {
    return $('destMode').value === 'local' ? stagesLocal : stagesRemote;
  }

  function setNode(id, cls) {
    const node = $(id);
    if (!node) return;
    const rect = node.querySelector('.node');
    if (rect) rect.setAttribute('class', 'node ' + (cls || ''));
  }

  function setEdge(id, cls) {
    const edge = $(id);
    if (edge) edge.setAttribute('class', 'edge ' + (cls || ''));
  }

  function render() {
    const arr = stages();
    if (step >= arr.length) step = arr.length - 1;
    if (step < 0) step = 0;
    const stage = arr[step];

    $('stageNo').textContent = `Bước ${step + 1} / ${arr.length}`;
    $('progressText').textContent = `${step + 1} / ${arr.length}`;
    $('progressFill').style.width = ((step + 1) / arr.length * 100) + '%';
    $('stageTitle').textContent = stage.title;
    $('stageDesc').textContent = stage.desc;
    $('stageList').innerHTML = stage.items.map(x => `<li>${x}</li>`).join('');
    $('stageCallout').innerHTML = '<strong>Điểm cần nhớ:</strong> ' + stage.call;
    $('stageCallout').className = 'callout ' + (step === arr.length - 1 ? 'good' : (step === 2 ? 'warn' : ''));
    $('prevBtn').disabled = step === 0;
    $('prevBtn').style.opacity = step === 0 ? '.45' : '1';
    $('nextBtn').textContent = step === arr.length - 1 ? '✓ Hoàn tất' : 'Tiếp theo →';
    $('nextBtn').disabled = step === arr.length - 1;
    $('nextBtn').style.opacity = step === arr.length - 1 ? '.5' : '1';
    $('miniSteps').innerHTML = arr.map((item, index) => `<div class="mini-step ${index === step ? 'current' : index < step ? 'done' : ''}"><b>${index < step ? '✓' : index + 1}</b><span>${item.title.replace(/^\d+\.\s*/, '')}</span></div>`).join('');

    ['node-laptop', 'node-switch', 'node-gw', 'node-r2', 'node-r3', 'node-r4', 'node-server', 'node-printer'].forEach(id => setNode(id, ''));
    ['e-lan', 'e-gw', 'e-main1', 'e-main2', 'e-main3', 'e-alt1', 'e-alt2', 'e-printer'].forEach(id => setEdge(id, ''));
    stage.focus.forEach(id => setNode(id, id === 'node-gw' ? 'gateway active' : 'active'));
    stage.edges.forEach(id => setEdge(id, 'active'));

    if (failed) {
      setEdge('e-main1', 'failed');
      setEdge('e-main2', 'failed');
      if ($('destMode').value === 'remote' && step >= 5) {
        setEdge('e-alt1', 'active');
        setEdge('e-alt2', 'active');
        setNode('node-r2', '');
        setNode('node-r4', 'active');
        setNode('node-r3', 'active');
        $('stageDesc').textContent = 'Mô phỏng sự cố: tuyến chính qua R2 bị gián đoạn. Nếu topology, tuyến dự phòng và cấu hình cho phép, router có thể chuyển lưu lượng qua R4 rồi tiếp tục đến R3.';
        $('stageCallout').innerHTML = '<strong>Khi có sự cố:</strong> Đường dự phòng chỉ hoạt động nếu đã có tuyến hợp lệ và mạng phát hiện/cập nhật lỗi. Thực tế có thể cần thời gian hội tụ.';
        $('stageCallout').className = 'callout warn';
      }
    }

    const local = $('destMode').value === 'local';
    $('node-printer').style.display = local ? '' : 'none';
    $('e-printer').style.display = local ? '' : 'none';
    $('node-r2').style.opacity = local ? '.42' : '1';
    $('node-r3').style.opacity = local ? '.42' : '1';
    $('node-r4').style.opacity = local ? '.42' : '1';
    $('node-server').style.opacity = local ? '.42' : '1';
    $('server-title').textContent = local ? 'Server' : 'Máy chủ';
    $('dest-ip').textContent = local ? '203.0.113.80' : '203.0.113.80';
    if (local) {
      $('dest-ip').textContent = 'Máy in: 192.168.10.50';
      $('server-title').textContent = 'Máy chủ';
      $('node-server').style.opacity = '.35';
      $('node-printer').style.display = '';
    }
    $('src-ip').textContent = '192.168.10.25';
    $('gw-ip').textContent = '192.168.10.1';
    $('failureBtn').textContent = failed ? '↩ Khôi phục tuyến chính' : '⚡ Mô phỏng đứt tuyến chính';
    $('failureBtn').classList.toggle('danger', !failed);
    $('failureBtn').classList.toggle('active', failed);
    $('failureBtn').disabled = local;
    $('failureBtn').title = local ? 'Chuyển sang kịch bản máy chủ ở Hà Nội để mô phỏng sự cố tuyến' : 'Mô phỏng sự cố tuyến chính và quan sát đường dự phòng';

    const packet = $('packet');
    packet.style.display = stage.packet ? '' : 'none';
    if (stage.packet) {
      const circle = packet.querySelector('circle');
      const label = packet.querySelector('text');
      let pos = stage.packet;
      if (failed && $('destMode').value === 'remote' && step === 5) pos = [630, 292];
      circle.setAttribute('cx', pos[0]);
      circle.setAttribute('cy', pos[1]);
      label.setAttribute('x', pos[0]);
      label.setAttribute('y', pos[1] + 4);
    }

    $('arpBubble').style.display = stage.arp ? '' : 'none';
    if (stage.arp) {
      $('arpText').textContent = local ? 'ARP Request · Broadcast' : 'ARP Request · Broadcast';
      $('arpBubble').querySelectorAll('text')[1].textContent = 'Who has ' + (local ? '192.168.10.50?' : '192.168.10.1?');
    }

    $('packetTable').innerHTML = stage.table.map(row => `<tr><td>${row[0]}</td><td>${row[1]}</td></tr>`).join('');

    document.dispatchEvent(new CustomEvent('legacy:render', { detail: { step: step, failed: failed, local: $('destMode').value === 'local', total: arr.length } }));
  }

  $('nextBtn').addEventListener('click', function () {
    step = Math.min(stages().length - 1, step + 1);
    render();
  });

  $('prevBtn').addEventListener('click', function () {
    step = Math.max(0, step - 1);
    render();
  });

  $('resetBtn').addEventListener('click', function () {
    stopAuto();
    step = 0;
    failed = false;
    render();
  });

  $('destMode').addEventListener('change', function () {
    stopAuto();
    step = 0;
    failed = false;
    render();
    resetQuiz();
  });

  $('failureBtn').addEventListener('click', function () {
    failed = !failed;
    render();
  });

  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
    $('autoBtn').textContent = '▶ Tự chạy';
  }

  $('autoBtn').addEventListener('click', function () {
    if (autoTimer) {
      stopAuto();
      return;
    }
    $('autoBtn').textContent = 'Ⅱ Tạm dừng';
    autoTimer = setInterval(function () {
      if (step >= stages().length - 1) {
        stopAuto();
        return;
      }
      step++;
      render();
    }, 2300);
  });

  const quiz = [
    { q: 'Khi máy chủ ở ngoài subnet, laptop cần ARP để tìm MAC của ai?', opts: ['MAC của máy chủ ở Hà Nội', 'MAC của default gateway trên LAN', 'MAC của DNS server trong mọi trường hợp'], a: 1, why: 'Đúng. Laptop gửi frame đầu tiên đến gateway; IP đích của datagram vẫn là máy chủ ở xa.' },
    { q: 'Khi đích cùng subnet với laptop, laptop thường tìm MAC của ai?', opts: ['MAC của thiết bị đích', 'MAC của router ISP ở xa', 'MAC của mọi router trên đường đi'], a: 0, why: 'Đúng. Khi đích cùng subnet, laptop gửi frame trực tiếp đến MAC của thiết bị đích.' }
  ];

  function drawQuiz() {
    const question = quiz[qi];
    $('quizQuestion').textContent = question.q;
    $('quizOptions').innerHTML = question.opts.map((option, index) => `<button class="option" data-i="${index}">${String.fromCharCode(65 + index)}. ${option}</button>`).join('');
    $('quizFeedback').textContent = 'Chọn đáp án phù hợp nhất.';
    $('quizOptions').querySelectorAll('.option').forEach(function (button) {
      button.addEventListener('click', function () {
        if (quizDone) return;
        quizDone = true;
        const chosen = Number(button.dataset.i);
        $('quizOptions').querySelectorAll('.option').forEach(function (item) {
          item.disabled = true;
        });
        button.classList.add(chosen === question.a ? 'correct' : 'wrong');
        if (chosen !== question.a) {
          const correct = $('quizOptions').querySelector('.option[data-i="' + question.a + '"]');
          if (correct) correct.classList.add('correct');
        }
        $('quizFeedback').textContent = (chosen === question.a ? '✓ Chính xác. ' : 'Chưa đúng. ') + question.why;
      });
    });
  }

  function resetQuiz() {
    quizDone = false;
    qi = $('destMode').value === 'local' ? 1 : 0;
    drawQuiz();
  }

  $('quizReset').addEventListener('click', resetQuiz);

  document.addEventListener('keydown', function (event) {
    if (!legacyRoot.classList.contains('active')) return;
    if (event.defaultPrevented) return;
    if (event.target && event.target.closest && event.target.closest('#viewTabs')) return;
    if (event.key === 'ArrowRight') $('nextBtn').click();
    if (event.key === 'ArrowLeft') $('prevBtn').click();
  });

  document.addEventListener('app:viewchange', function (event) {
    if (!event.detail || event.detail.view !== 'legacy') stopAuto();
  });

  window.NetLab = window.NetLab || {};
  window.NetLab.legacy = {
    getState: function () {
      return { step: step, failed: failed, local: $('destMode').value === 'local', total: stages().length };
    },
    reset: function () {
      stopAuto();
      step = 0;
      failed = false;
      render();
    }
  };

  render();
  resetQuiz();
})();
