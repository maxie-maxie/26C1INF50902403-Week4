(function (root) {
  'use strict';

  const NetLab = root.NetLab = root.NetLab || {};

  const $ = function (id) {
    return document.getElementById(id);
  };

  function legacyState() {
    if (NetLab.legacy && typeof NetLab.legacy.getState === 'function') {
      return NetLab.legacy.getState();
    }
    return { step: 0, failed: false, local: true, total: 7 };
  }

  function getArpPhase(phase, sourceId, macOf) {
    const isRequest = phase === 2;
    const isReply = phase === 3;
    return {
      isArp: isRequest || isReply,
      message: isRequest ? 'ARP Request' : isReply ? 'ARP Reply' : phase >= 4 ? 'Ethernet / IPv4' : 'Kiểm tra địa chỉ',
      sourceMac: (isRequest || isReply) ? macOf(sourceId) : null,
      destinationMac: isRequest ? 'FF:FF:FF:FF:FF:FF' : isReply ? macOf(sourceId) : null
    };
  }

  function findWeightedPath(devices, links, startId, endId, excludeMain) {
    if (!startId || !endId || startId === endId) return [];
    const dist = Object.fromEntries(devices.map(d => [d.id, Infinity]));
    const prev = {}, used = new Set();
    dist[startId] = 0;
    while (used.size < devices.length) {
      let u = null, best = Infinity;
      for (const id of Object.keys(dist)) if (!used.has(id) && dist[id] < best) { best = dist[id]; u = id; }
      if (u === null || u === endId) break;
      used.add(u);
      for (const link of links) {
        if (!link.up || (excludeMain && link.kind === 'main')) continue;
        const v = link.from === u ? link.to : link.to === u ? link.from : null;
        if (v !== null && dist[u] + Number(link.cost || 1) < dist[v]) {
          dist[v] = dist[u] + Number(link.cost || 1);
          prev[v] = { node: u, link: link.id };
        }
      }
    }
    if (!prev[endId]) return [];
    const path = []; let cur = endId;
    while (cur !== startId && prev[cur]) { path.unshift({ from: prev[cur].node, to: cur, link: prev[cur].link }); cur = prev[cur].node; }
    return cur === startId ? path : [];
  }

  function buildFrameFields({ source, destination, currentNode, nextNode, hop, link, phase, macOf, arpInfo }) {
    return [
      ['IP nguồn', source.ip || 'Chưa cấu hình'], ['IP đích', destination.ip || 'Chưa cấu hình'],
      ['Thiết bị đang xử lý', currentNode?.name || '—'], ['Chặng đang quan sát', nextNode ? `${currentNode.name} → ${nextNode.name}` : 'Chưa chuyển frame'],
      ['MAC nguồn', arpInfo.sourceMac || (phase >= 4 ? macOf(currentNode?.id) : 'Chưa tạo frame')],
      ['MAC đích', arpInfo.destinationMac || (phase >= 4 && nextNode ? macOf(nextNode.id) : 'Chưa phân giải')],
      ['Loại bản tin', arpInfo.message],
      ['Liên kết', hop ? `${link?.name || hop.link} · ${link?.up ? 'UP' : 'DOWN'}` : 'Chưa truyền'],
      ['Next hop', nextNode?.ip || 'Chưa xác định'], ['TTL minh họa', phase >= 4 ? String(Math.max(1, 64 - Math.max(0, phase - 4))) : '64 (ban đầu)']
    ];
  }

  function cloneScenario(scenarios, key) {
    const scenario = scenarios[key];
    if (!scenario) throw new Error(`Topology mẫu không tồn tại: ${key}`);
    return structuredClone(scenario);
  }

  function setTimelineRunning(button, running) {
    if (button) button.textContent = running ? 'Ⅱ Tạm dừng' : '▶ Tự chạy';
  }
  function nextTimelineStep(current, total) { return Math.min(Math.max(0, total - 1), current + 1); }
  function previousTimelineStep(current, total) { return Math.max(0, Math.min(total - 1, current - 1)); }

  const topologyPresets = {
    office: {
      devices:[
        {id:'pc1',type:'pc',name:'PC Văn phòng',ip:'192.168.10.25/24',iface:'Fa0',role:'Máy trạm người dùng',subnet:'192.168.10.0/24',x:90,y:145},
        {id:'sw1',type:'switch',name:'SW-Office',ip:'Management: 192.168.10.2',iface:'Fa0/1–Fa0/8',role:'Switch truy cập LAN',subnet:'VLAN 10',x:300,y:145},
        {id:'r1',type:'router',name:'R1 Gateway',ip:'192.168.10.1/24',iface:'G0/0',role:'Default Gateway',subnet:'192.168.10.0/24',x:510,y:145},
        {id:'isp',type:'router',name:'ISP Router',ip:'10.0.0.2/30',iface:'G0/0',role:'Router nhà cung cấp',subnet:'10.0.0.0/30',x:710,y:75},
        {id:'srv',type:'server',name:'Web Server',ip:'203.0.113.80/24',iface:'Fa0',role:'Máy chủ dịch vụ',subnet:'203.0.113.0/24',x:710,y:245}
      ],
      links:[
        {id:'l1',from:'pc1',to:'sw1',name:'PC1 – SW1',iface:'PC Fa0 ↔ SW Fa0/1',cost:1,up:true,kind:'main'},
        {id:'l2',from:'sw1',to:'r1',name:'SW1 – R1',iface:'SW Fa0/8 ↔ R1 G0/0',cost:1,up:true,kind:'main'},
        {id:'l3',from:'r1',to:'isp',name:'R1 – ISP',iface:'R1 G0/1 ↔ ISP G0/0',cost:10,up:true,kind:'main'},
        {id:'l4',from:'isp',to:'srv',name:'ISP – Server',iface:'ISP G0/1 ↔ Server Fa0',cost:5,up:true,kind:'main'}
      ]
    },
    enterprise:{
      devices:[
        {id:'hq',type:'router',name:'R-HCM',ip:'10.10.0.1/24',iface:'G0/0',role:'Router trụ sở TP.HCM',subnet:'10.10.0.0/24',x:130,y:170},
        {id:'bd',type:'router',name:'R-BD',ip:'10.20.0.1/24',iface:'G0/0',role:'Router kho Bình Dương',subnet:'10.20.0.0/24',x:390,y:75},
        {id:'hn',type:'router',name:'R-HN',ip:'10.30.0.1/24',iface:'G0/0',role:'Router văn phòng Hà Nội',subnet:'10.30.0.0/24',x:390,y:265},
        {id:'core',type:'router',name:'R-Core',ip:'172.16.0.1/30',iface:'G0/0',role:'Router mạng lõi',subnet:'172.16.0.0/30',x:660,y:170},
        {id:'data',type:'server',name:'Data Center',ip:'172.16.10.10/24',iface:'Fa0',role:'Máy chủ dữ liệu',subnet:'172.16.10.0/24',x:830,y:170}
      ],
      links:[
        {id:'e1',from:'hq',to:'bd',name:'HCM – Bình Dương',iface:'G0/1 ↔ G0/1',cost:10,up:true,kind:'main'},
        {id:'e2',from:'bd',to:'core',name:'Bình Dương – Core',iface:'G0/2 ↔ G0/1',cost:10,up:true,kind:'main'},
        {id:'e3',from:'hq',to:'hn',name:'HCM – Hà Nội',iface:'G0/2 ↔ G0/1',cost:20,up:true,kind:'backup'},
        {id:'e4',from:'hn',to:'core',name:'Hà Nội – Core',iface:'G0/2 ↔ G0/2',cost:10,up:true,kind:'backup'},
        {id:'e5',from:'core',to:'data',name:'Core – Data Center',iface:'G0/3 ↔ Fa0',cost:5,up:true,kind:'main'}
      ]
    },
    datacenter:{
      devices:[
        {id:'edge',type:'router',name:'Edge Router',ip:'192.0.2.1/30',iface:'G0/0',role:'Router biên',subnet:'192.0.2.0/30',x:100,y:175},
        {id:'fw',type:'router',name:'Firewall',ip:'192.0.2.2/30',iface:'G0/1',role:'Tường lửa mạng',subnet:'192.0.2.0/30',x:310,y:175},
        {id:'core1',type:'switch',name:'Core Switch',ip:'10.0.0.2',iface:'Te1/1',role:'Switch lõi trung tâm dữ liệu',subnet:'VLAN 100',x:520,y:175},
        {id:'app',type:'server',name:'App Server',ip:'10.0.10.10/24',iface:'Eth0',role:'Máy chủ ứng dụng',subnet:'10.0.10.0/24',x:745,y:85},
        {id:'db',type:'server',name:'Database',ip:'10.0.20.10/24',iface:'Eth0',role:'Máy chủ cơ sở dữ liệu',subnet:'10.0.20.0/24',x:745,y:265}
      ],
      links:[
        {id:'d1',from:'edge',to:'fw',name:'Edge – Firewall',iface:'G0/0 ↔ G0/0',cost:2,up:true,kind:'main'},
        {id:'d2',from:'fw',to:'core1',name:'Firewall – Core',iface:'G0/1 ↔ Te1/1',cost:2,up:true,kind:'main'},
        {id:'d3',from:'core1',to:'app',name:'Core – App',iface:'Te1/2 ↔ Eth0',cost:5,up:true,kind:'main'},
        {id:'d4',from:'core1',to:'db',name:'Core – DB',iface:'Te1/3 ↔ Eth0',cost:5,up:true,kind:'main'}
      ]
    },
    smalllan:{
      devices:[
        {id:'slpc1',type:'pc',name:'PC 1',ip:'192.168.1.10/24',iface:'Fa0',role:'Máy trạm',subnet:'192.168.1.0/24',x:90,y:145},
        {id:'slpc2',type:'pc',name:'PC 2',ip:'192.168.1.11/24',iface:'Fa0',role:'Máy trạm',subnet:'192.168.1.0/24',x:90,y:255},
        {id:'slsw',type:'switch',name:'SW Access',ip:'192.168.1.2',iface:'Fa0/1–Fa0/8',role:'Switch truy cập',subnet:'LAN',x:340,y:200},
        {id:'slr',type:'router',name:'Gateway',ip:'192.168.1.1/24',iface:'G0/0',role:'Default Gateway',subnet:'192.168.1.0/24',x:590,y:200},
        {id:'slsrv',type:'server',name:'File Server',ip:'192.168.1.100/24',iface:'Fa0',role:'Máy chủ nội bộ',subnet:'192.168.1.0/24',x:790,y:200}
      ],links:[
        {id:'sl1',from:'slpc1',to:'slsw',name:'PC1 – SW',iface:'Fa0 ↔ Fa0/1',cost:1,up:true,kind:'main'},
        {id:'sl2',from:'slpc2',to:'slsw',name:'PC2 – SW',iface:'Fa0 ↔ Fa0/2',cost:1,up:true,kind:'main'},
        {id:'sl3',from:'slsw',to:'slr',name:'SW – Gateway',iface:'Fa0/8 ↔ G0/0',cost:1,up:true,kind:'main'},
        {id:'sl4',from:'slr',to:'slsrv',name:'Gateway – Server',iface:'G0/1 ↔ Fa0',cost:2,up:true,kind:'main'}
      ]
    },
    vlan:{
      devices:[
        {id:'vpc1',type:'pc',name:'PC Sales',ip:'192.168.10.10/24',iface:'Fa0',role:'Máy trạm VLAN 10',subnet:'VLAN 10 · 192.168.10.0/24',x:75,y:95},
        {id:'vpc2',type:'pc',name:'PC Marketing',ip:'192.168.20.10/24',iface:'Fa0',role:'Máy trạm VLAN 20',subnet:'VLAN 20 · 192.168.20.0/24',x:75,y:270},
        {id:'vsw',type:'switch',name:'SW Layer 2',ip:'192.168.10.2',iface:'Fa0/1–Fa0/24',role:'Switch access · trunk uplink',subnet:'VLAN 10, 20',x:330,y:180},
        {id:'vr',type:'router',name:'Router-on-a-stick',ip:'192.168.10.1 / 20.1',iface:'G0/0.10, G0/0.20',role:'Định tuyến liên VLAN',subnet:'VLAN 10 và VLAN 20',x:590,y:180},
        {id:'vserver',type:'server',name:'Server nội bộ',ip:'192.168.30.10/24',iface:'G0/1',role:'Máy chủ dịch vụ',subnet:'VLAN 30',x:805,y:180}
      ],links:[
        {id:'v1',from:'vpc1',to:'vsw',name:'Sales – Switch',iface:'Fa0 ↔ Fa0/1 access',cost:1,up:true,kind:'main'},
        {id:'v2',from:'vpc2',to:'vsw',name:'Marketing – Switch',iface:'Fa0 ↔ Fa0/2 access',cost:1,up:true,kind:'main'},
        {id:'v3',from:'vsw',to:'vr',name:'Trunk – Router',iface:'Gi0/1 trunk ↔ G0/0',cost:2,up:true,kind:'main'},
        {id:'v4',from:'vr',to:'vserver',name:'Router – Server',iface:'G0/1 ↔ Eth0',cost:2,up:true,kind:'main'}
      ]
    },
    ring:{
      devices:[
        {id:'ra',type:'router',name:'R1',ip:'10.0.1.1/30',iface:'G0/0',role:'Router vòng',subnet:'10.0.1.0/30',x:450,y:45},
        {id:'rb',type:'router',name:'R2',ip:'10.0.2.1/30',iface:'G0/1',role:'Router vòng',subnet:'10.0.2.0/30',x:730,y:145},
        {id:'rc',type:'router',name:'R3',ip:'10.0.3.1/30',iface:'G0/2',role:'Router vòng',subnet:'10.0.3.0/30',x:620,y:285},
        {id:'rd',type:'router',name:'R4',ip:'10.0.4.1/30',iface:'G0/3',role:'Router vòng',subnet:'10.0.4.0/30',x:280,y:285},
        {id:'re',type:'router',name:'R5',ip:'10.0.5.1/30',iface:'G0/4',role:'Router vòng',subnet:'10.0.5.0/30',x:170,y:145},
        {id:'rhost',type:'server',name:'Destination',ip:'172.16.0.10/24',iface:'Eth0',role:'Máy chủ đích',subnet:'172.16.0.0/24',x:450,y:175}
      ],links:[
        {id:'r1',from:'ra',to:'rb',name:'R1 – R2',iface:'G0/0 ↔ G0/0',cost:5,up:true,kind:'main'},
        {id:'r2',from:'rb',to:'rc',name:'R2 – R3',iface:'G0/1 ↔ G0/1',cost:5,up:true,kind:'main'},
        {id:'r3',from:'rc',to:'rd',name:'R3 – R4',iface:'G0/2 ↔ G0/2',cost:5,up:true,kind:'main'},
        {id:'r4',from:'rd',to:'re',name:'R4 – R5',iface:'G0/3 ↔ G0/3',cost:5,up:true,kind:'main'},
        {id:'r5',from:'re',to:'ra',name:'R5 – R1',iface:'G0/4 ↔ G0/4',cost:5,up:true,kind:'main'},
        {id:'r6',from:'ra',to:'rhost',name:'R1 – Destination',iface:'G0/5 ↔ Eth0',cost:12,up:true,kind:'backup'}
      ]
    },
    dualisp:{
      devices:[
        {id:'dpcl',type:'pc',name:'PC Office',ip:'192.168.50.10/24',iface:'Fa0',role:'Máy trạm doanh nghiệp',subnet:'192.168.50.0/24',x:70,y:180},
        {id:'dsw',type:'switch',name:'SW Office',ip:'192.168.50.2',iface:'Fa0/1–Fa0/8',role:'Switch LAN',subnet:'VLAN 50',x:250,y:180},
        {id:'dr',type:'router',name:'Edge Router',ip:'192.168.50.1/24',iface:'G0/0',role:'Router biên doanh nghiệp',subnet:'192.168.50.0/24',x:440,y:180},
        {id:'di1',type:'router',name:'ISP 1',ip:'203.0.113.1/30',iface:'G0/0',role:'ISP chính',subnet:'203.0.113.0/30',x:650,y:85},
        {id:'di2',type:'router',name:'ISP 2',ip:'198.51.100.1/30',iface:'G0/0',role:'ISP dự phòng',subnet:'198.51.100.0/30',x:650,y:275},
        {id:'dsv',type:'server',name:'Internet Server',ip:'203.0.113.80/24',iface:'Eth0',role:'Máy chủ đích mô phỏng',subnet:'203.0.113.0/24',x:830,y:180}
      ],links:[
        {id:'diL1',from:'dpcl',to:'dsw',name:'PC – Switch',iface:'Fa0 ↔ Fa0/1',cost:1,up:true,kind:'main'},
        {id:'diL2',from:'dsw',to:'dr',name:'Switch – Edge',iface:'Fa0/8 ↔ G0/0',cost:1,up:true,kind:'main'},
        {id:'diL3',from:'dr',to:'di1',name:'Edge – ISP 1',iface:'G0/1 ↔ G0/0',cost:10,up:true,kind:'main'},
        {id:'diL4',from:'dr',to:'di2',name:'Edge – ISP 2',iface:'G0/2 ↔ G0/0',cost:20,up:true,kind:'backup'},
        {id:'diL5',from:'di1',to:'dsv',name:'ISP 1 – Server',iface:'G0/1 ↔ Eth0',cost:5,up:true,kind:'main'},
        {id:'diL6',from:'di2',to:'dsv',name:'ISP 2 – Server',iface:'G0/1 ↔ Eth1',cost:8,up:true,kind:'backup'}
      ]
    }
  };

  let topo = null, selectedDevice = null, selectedLink = null, deviceSeq = 1;
  const typeMeta = {pc:{icon:'💻',label:'PC / Laptop'},switch:{icon:'🔀',label:'Switch'},router:{icon:'🌐',label:'Router'},server:{icon:'🗄️',label:'Server'}};

  function cloneTopology(key){return cloneScenario(topologyPresets,key);}
  function deviceById(id){return topo.devices.find(d=>d.id===id);}
  function linkById(id){return topo.links.find(l=>l.id===id);}
  function findTopologyPath(startId, endId, excludeMain=false){ return findWeightedPath(topo.devices, topo.links, startId, endId, excludeMain); }

  function renderTopologyFrame(source,destination,path){
    const fields=$('topoFrameFields'), note=$('topoFrameNote'), label=$('topoFrameStep');
    if(!fields)return;
    const phase=Math.min(6,Math.max(0,legacyState().step));
    label.textContent=`Bước ${phase+1} / 7`;
    if(!source||!destination){fields.innerHTML='';note.textContent='Topology đang trống. Hãy thêm thiết bị và liên kết để quan sát thông tin frame.';return;}
    const hop=phase<=1?null:phase<=3?path[0]:phase===4?path[0]:phase===5?path[Math.max(0,path.length-2)]:path[path.length-1];
    const a=hop?deviceById(hop.from):source,b=hop?deviceById(hop.to):null;
    const mac=id=>{let h=0;for(const c of String(id||''))h=(h*31+c.charCodeAt(0))>>>0;return '02:'+ [24,16,8,0].map(k=>((h>>>k)&255).toString(16).padStart(2,'0')).join(':')+':01';};
    const arpInfo=getArpPhase(phase,source.id,mac);
    const rows=buildFrameFields({source,destination,currentNode:a,nextNode:b,hop,link:hop?linkById(hop.link):null,phase,macOf:mac,arpInfo});
    fields.innerHTML=rows.map(([k,v])=>`<div class="topo-frame-field"><b>${escapeTopo(k)}</b><span>${escapeTopo(v)}</span></div>`).join('');
    const notes=[
      'Máy nguồn so sánh địa chỉ IP đích với subnet để xác định đích cục bộ hay ở mạng khác.',
      'Thiết bị nguồn chọn next hop phù hợp. Nếu chưa có MAC, cần phân giải ARP.',
      'ARP Request sử dụng MAC broadcast FF:FF:FF:FF:FF:FF trong miền quảng bá cục bộ.',
      'ARP Reply trả về ánh xạ IP–MAC của thiết bị được hỏi; thông tin có thể được lưu trong ARP cache.',
      'Frame được gửi trên liên kết đầu tiên. Địa chỉ MAC thuộc chặng hiện tại.',
      'Router tra bảng định tuyến và đóng gói lại frame cho từng liên kết; IP nguồn/đích giữ nguyên khi không có NAT.',
      'Gói tin tới đích nếu tồn tại đường đi đang hoạt động. Chiều phản hồi cần có đường định tuyến ngược.'
    ];
    note.textContent=path.length||source.id===destination.id?notes[phase]:'Không tìm thấy đường đi đang hoạt động giữa nguồn và đích. Hãy kiểm tra các liên kết.';
  }

  function renderTopology(){
    const svg=$('topologyCanvas'); if(!svg||!topo)return;
    if(topo.devices.length===0){
      svg.innerHTML='<text class="topology-empty" x="450" y="165">Topology đang trống</text><text class="topology-empty" x="450" y="195" style="font-size:13px;font-weight:400">Chọn mẫu topology hoặc thêm thiết bị mới để bắt đầu</text>';
      $('linkSelect').innerHTML='';$('linkFrom').innerHTML='';$('linkTo').innerHTML='';
      selectedDevice=null;selectedLink=null;updateLinkControls();updateDeviceDetails();updateTopologySummary();renderTopologyFrame(null,null,[]);return;
    }
    const pos=Object.fromEntries(topo.devices.map(d=>[d.id,d]));
    const source=topo.devices.find(d=>d.type==='pc')||topo.devices.find(d=>d.type==='router')||topo.devices[0];
    const destination=[...topo.devices].reverse().find(d=>d.type==='server')||topo.devices[topo.devices.length-1];
    let path=findTopologyPath(source?.id,destination?.id,false);
    const state=legacyState();
    if(state.failed){const backup=findTopologyPath(source?.id,destination?.id,true);if(backup.length)path=backup;}
    const currentStage=state.step;
    let activeLinkIds=new Set(),activeNodeIds=new Set();
    if(source)activeNodeIds.add(source.id);
    if(destination && currentStage===0)activeNodeIds.add(destination.id);
    if(currentStage===1 || currentStage===2 || currentStage===3){
      const first=path[0];if(first){activeNodeIds.add(first.to);if(currentStage===1||currentStage===3)activeLinkIds.add(first.link);}
      if(currentStage===2 && source){topo.links.filter(l=>l.up&&(l.from===source.id||l.to===source.id)).forEach(l=>{activeLinkIds.add(l.id);activeNodeIds.add(l.from===source.id?l.to:l.from);});}
    }
    if(currentStage>=4){
      const count=currentStage===4?Math.min(1,path.length):currentStage===5?Math.max(1,path.length-1):path.length;
      path.slice(0,count).forEach(x=>{activeLinkIds.add(x.link);activeNodeIds.add(x.from);activeNodeIds.add(x.to);});
      if(currentStage>=6 && destination)activeNodeIds.add(destination.id);
    }
    let out='';
    topo.links.forEach(l=>{
      const a=pos[l.from],b=pos[l.to];if(!a||!b)return;
      let cls='topo-edge '+(l.up?(l.kind==='backup'?'backup':'main'):'down')+(l.id===selectedLink?' selected':'');
      if(activeLinkIds.has(l.id)&&l.up)cls+=' sim-active';
      if(currentStage===2 && activeLinkIds.has(l.id)&&l.up)cls+=' sim-broadcast';
      const mx=(a.x+b.x)/2+48,my=(a.y+b.y)/2+10;
      out+=`<g data-link="${l.id}"><line class="${cls}" x1="${a.x+48}" y1="${a.y+22}" x2="${b.x+48}" y2="${b.y+22}"/><text class="topo-edge-label" x="${mx}" y="${my}">${l.cost} · ${l.up?'UP':'DOWN'}</text></g>`;
    });
    topo.devices.forEach(d=>{
      const m=typeMeta[d.type]||typeMeta.pc;
      const cls='topo-node '+(d.id===selectedDevice?'selected ':'')+(activeNodeIds.has(d.id)?'sim-active ':'')+(d.id===source?.id?'sim-source':'');
      out+=`<g class="${cls}" data-device="${d.id}" transform="translate(${d.x},${d.y})"><rect width="96" height="54"/><text x="48" y="21" font-size="18">${m.icon}</text><text class="name" x="48" y="37">${escapeTopo(d.name)}</text><text class="ip" x="48" y="49">${escapeTopo(d.ip.split('/')[0])}</text></g>`;
    });
    // Vị trí marker suy từ tuyến đi thực tế của topology đang chọn; số bước là tiến độ trên tuyến, không phải tọa độ cố định.
    const nodeCenter = d => d ? [d.x + 48, d.y + 22] : null;
    const routeNodes = source ? [source, ...path.map(h => pos[h.to]).filter(Boolean)] : [];
    const midpoint = (a, b) => a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : (a || b);
    const sourcePoint = nodeCenter(source);
    const destinationPoint = nodeCenter(destination);
    // Switch không tham gia quyết định next-hop ở tầng IP: marker IP đặt tại router đầu/tiếp theo trên tuyến đã tính, không đặt lên switch trung gian.
    const routeRouters = routeNodes.slice(1).filter(d => d.type === 'router');
    const firstHopPoint = routeRouters.length ? nodeCenter(routeRouters[0]) : destinationPoint;
    const secondHopPoint = routeRouters.length > 1 ? nodeCenter(routeRouters[1]) : destinationPoint;
    const localScenario = $('destMode').value === 'local';
    let marker = sourcePoint, markerLabel = 'IP';
    if (localScenario) {
      if (currentStage === 1) { marker = sourcePoint; markerLabel = 'ARP'; }
      else if (currentStage === 2) { marker = midpoint(destinationPoint, sourcePoint); markerLabel = 'ARP'; }
      else if (currentStage >= 3) marker = destinationPoint;
    } else {
      if (currentStage === 2) { marker = sourcePoint; markerLabel = 'ARP'; }
      else if (currentStage === 3) { marker = midpoint(firstHopPoint, sourcePoint); markerLabel = 'ARP'; }
      else if (currentStage === 4) marker = firstHopPoint;
      else if (currentStage === 5) marker = secondHopPoint;
      else if (currentStage >= 6) marker = destinationPoint;
    }
    if(marker){const [cx,cy]=marker;out+=`<circle class="topo-packet" cx="${cx}" cy="${cy}" r="13"><title>${markerLabel==='ARP'?'Thông điệp ARP':'Gói IP'}</title></circle><text class="topo-packet-label" x="${cx}" y="${cy+3}">${markerLabel}</text>`;}
    svg.innerHTML=out;
    $('linkSelect').innerHTML=topo.links.map(l=>`<option value="${l.id}">${escapeTopo(l.name)} (${l.up?'UP':'DOWN'})</option>`).join('');
    const deviceOptions=topo.devices.map(d=>`<option value="${d.id}">${escapeTopo(d.name)}</option>`).join('');
    const oldFrom=$('linkFrom').value,oldTo=$('linkTo').value;
    $('linkFrom').innerHTML=deviceOptions;$('linkTo').innerHTML=deviceOptions;
    if(topo.devices.some(d=>d.id===oldFrom))$('linkFrom').value=oldFrom;
    else if(topo.devices.length>0)$('linkFrom').value=topo.devices[0].id;
    if(topo.devices.some(d=>d.id===oldTo))$('linkTo').value=oldTo;
    else if(topo.devices.length>1)$('linkTo').value=topo.devices[1].id;
    refreshPortChoices();
    if(!selectedLink||!linkById(selectedLink))selectedLink=topo.links[0]?.id||null;
    $('linkSelect').value=selectedLink||'';
    updateLinkControls(); updateDeviceDetails(); updateTopologySummary(); renderTopologyFrame(source,destination,path);
  }

  function escapeTopo(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function portsFor(d){
    if(!d)return [];
    if(d.type==='pc')return ['Fa0','Wi-Fi'];
    if(d.type==='server')return ['Fa0','Gi0','Eth0','Eth1'];
    if(d.type==='switch')return Array.from({length:24},(_,i)=>`Fa0/${i+1}`).concat(['Gi0/1','Gi0/2']);
    if(d.type==='router')return ['G0/0','G0/1','G0/2','G0/3','S0/0/0','S0/0/1'];
    return ['Port1','Port2'];
  }

  function refreshPortChoices(){
    if(!topo)return;
    const fill=(selectId,deviceId)=>{const d=deviceById(deviceId),sel=$(selectId),ports=portsFor(d);const previous=sel.value;sel.innerHTML=ports.map(x=>`<option value="${escapeTopo(x)}">${escapeTopo(x)}</option>`).join('');if(ports.includes(previous))sel.value=previous;};
    fill('linkFromPort',$('linkFrom').value);fill('linkToPort',$('linkTo').value);
  }

  function updateDeviceDetails(){
    const d=deviceById(selectedDevice);
    if(!d){$('deviceDetails').textContent='Chọn một thiết bị trên sơ đồ để xem thông tin.';['editDeviceName','editDeviceIp','editDeviceSubnet','editDeviceIface','editDeviceRole','saveDeviceBtn'].forEach(id=>$(id).disabled=true);return;}
    ['editDeviceName','editDeviceIp','editDeviceSubnet','editDeviceIface','editDeviceRole'].forEach(id=>$(id).disabled=false);
    $('deviceDetails').innerHTML=`<div class="detail-row"><b>Tên</b><span>${escapeTopo(d.name)}</span></div><div class="detail-row"><b>Loại</b><span>${typeMeta[d.type].label}</span></div><div class="detail-row"><b>Địa chỉ IP</b><span>${escapeTopo(d.ip)}</span></div><div class="detail-row"><b>Subnet / VLAN</b><span>${escapeTopo(d.subnet||'Chưa khai báo')}</span></div><div class="detail-row"><b>Interface</b><span>${escapeTopo(d.iface||'Chưa gán')}</span></div><div class="detail-row"><b>Vai trò</b><span>${escapeTopo(d.role||'Thiết bị mạng')}</span></div>`;
    $('editDeviceName').value=d.name||'';$('editDeviceIp').value=d.ip||'';$('editDeviceSubnet').value=d.subnet||'';$('editDeviceIface').value=d.iface||'';$('editDeviceRole').value=d.role||'';
    $('saveDeviceBtn').disabled=false;
  }

  function updateLinkControls(){
    const l=linkById(selectedLink);
    $('disconnectLinkBtn').disabled=!l||!l.up;$('restoreLinkBtn').disabled=!l||l.up;
    $('saveCostBtn').disabled=!l;$('linkCost').disabled=!l;$('linkSelect').disabled=topo.links.length===0;
    if(!l){$('linkCost').value='';return;}
    $('linkSelect').value=l.id;$('linkCost').value=l.cost;
  }

  function updateTopologySummary(){
    const up=topo.links.filter(l=>l.up).length,down=topo.links.length-up;
    $('topologySummary').innerHTML=`<div>Thiết bị: <b>${topo.devices.length}</b></div><div>Liên kết: <b>${topo.links.length}</b></div><div>Đang hoạt động: <b style="color:#0b8177">${up}</b></div><div>Đang bị ngắt: <b style="color:#c43d3d">${down}</b></div><div>Thiết bị đang chọn: <b>${selectedDevice?escapeTopo(deviceById(selectedDevice)?.name||'Không có'):'Chưa chọn'}</b></div>`;
  }

  function selectTopology(key){
    topo=cloneTopology(key);selectedDevice=topo.devices[0]?.id||null;selectedLink=topo.links[0]?.id||null;renderTopology();
  }

  $('topologyPreset').addEventListener('change',e=>selectTopology(e.target.value));

  // Kéo thả trên SVG: cập nhật tọa độ thiết bị và hai đầu liên kết ngay trong lúc kéo.
  const dragState={id:null,pointerId:null,offsetX:0,offsetY:0,moved:false};
  const canvas=$('topologyCanvas');
  function svgPoint(evt){const pt=canvas.createSVGPoint();pt.x=evt.clientX;pt.y=evt.clientY;return pt.matrixTransform(canvas.getScreenCTM().inverse());}
  function updateDraggedGeometry(){
    const positions=Object.fromEntries(topo.devices.map(d=>[d.id,d]));
    const node=canvas.querySelector(`[data-device="${dragState.id}"]`),d=deviceById(dragState.id);
    if(node&&d)node.setAttribute('transform',`translate(${d.x},${d.y})`);
    topo.links.forEach(l=>{const a=positions[l.from],b=positions[l.to];if(!a||!b)return;const g=canvas.querySelector(`[data-link="${l.id}"]`);if(!g)return;const line=g.querySelector('line'),label=g.querySelector('text');if(line){line.setAttribute('x1',a.x+48);line.setAttribute('y1',a.y+22);line.setAttribute('x2',b.x+48);line.setAttribute('y2',b.y+22);}if(label){label.setAttribute('x',(a.x+b.x)/2+48);label.setAttribute('y',(a.y+b.y)/2+10);}});
  }
  canvas.addEventListener('pointerdown',e=>{const node=e.target.closest('[data-device]');if(!node||!topo)return;const d=deviceById(node.dataset.device);if(!d)return;const pt=svgPoint(e);dragState.id=d.id;dragState.pointerId=e.pointerId;dragState.offsetX=pt.x-d.x;dragState.offsetY=pt.y-d.y;dragState.moved=false;canvas.setPointerCapture(e.pointerId);selectedDevice=d.id;node.style.cursor='grabbing';});
  canvas.addEventListener('pointermove',e=>{if(!dragState.id||e.pointerId!==dragState.pointerId)return;const d=deviceById(dragState.id);if(!d)return;const pt=svgPoint(e);const nx=Math.max(5,Math.min(850,pt.x-dragState.offsetX)),ny=Math.max(5,Math.min(325,pt.y-dragState.offsetY));if(Math.abs(nx-d.x)+Math.abs(ny-d.y)>1)dragState.moved=true;d.x=nx;d.y=ny;updateDraggedGeometry();});
  function finishDeviceDrag(e){if(!dragState.id||e.pointerId!==dragState.pointerId)return;const moved=dragState.moved;dragState.id=null;dragState.pointerId=null;if(moved){suppressTopologyClick=true;renderTopology();setTimeout(()=>{suppressTopologyClick=false;},0);}else{renderTopology();}}
  let suppressTopologyClick=false;
  canvas.addEventListener('pointerup',finishDeviceDrag);canvas.addEventListener('pointercancel',finishDeviceDrag);
  canvas.addEventListener('click',e=>{
    if(suppressTopologyClick)return;
    const node=e.target.closest('[data-device]'),edge=e.target.closest('[data-link]');
    if(node){selectedDevice=node.dataset.device;renderTopology();}
    else if(edge){selectedLink=edge.dataset.link;renderTopology();}
  });
  $('linkSelect').addEventListener('change',e=>{selectedLink=e.target.value;updateLinkControls();renderTopology();});
  $('disconnectLinkBtn').addEventListener('click',()=>{const l=linkById(selectedLink);if(l){l.up=false;renderTopology();}});
  $('restoreLinkBtn').addEventListener('click',()=>{const l=linkById(selectedLink);if(l){l.up=true;renderTopology();}});
  $('saveCostBtn').addEventListener('click',()=>{const l=linkById(selectedLink),v=Number($('linkCost').value);if(!l)return;if(!Number.isInteger(v)||v<1||v>999){alert('Cost phải là số nguyên từ 1 đến 999.');return;}l.cost=v;renderTopology();});
  $('linkFrom').addEventListener('change',refreshPortChoices);$('linkTo').addEventListener('change',refreshPortChoices);
  $('saveDeviceBtn').addEventListener('click',()=>{
    const d=deviceById(selectedDevice);if(!d)return;
    const name=$('editDeviceName').value.trim(),ip=$('editDeviceIp').value.trim();
    if(!name||!ip){alert('Tên thiết bị và địa chỉ IP không được để trống.');return;}
    d.name=name;d.ip=ip;d.subnet=$('editDeviceSubnet').value.trim();d.iface=$('editDeviceIface').value.trim();d.role=$('editDeviceRole').value.trim();
    topo.links.forEach(l=>{const a=deviceById(l.from),b=deviceById(l.to);l.name=`${a?.name||'?' } – ${b?.name||'?'}`;});renderTopology();
  });
  $('createLinkBtn').addEventListener('click',()=>{
    const from=$('linkFrom').value,to=$('linkTo').value,fromPort=$('linkFromPort').value,toPort=$('linkToPort').value;
    if(!from||!to||from===to){alert('Hãy chọn hai thiết bị khác nhau để kết nối.');return;}
    if(!fromPort||!toPort){alert('Hãy chọn cổng ở cả hai đầu kết nối.');return;}
    if(topo.links.some(l=>(l.from===from&&l.to===to)||(l.from===to&&l.to===from))){alert('Hai thiết bị này đã có liên kết.');return;}
    const occupied=(dev,port)=>topo.links.some(l=>l.up&&((l.from===dev&&(l.fromPort||'')===port)||(l.to===dev&&(l.toPort||'')===port)));
    if(occupied(from,fromPort)||occupied(to,toPort)){alert('Một trong hai cổng đã được sử dụng bởi liên kết đang hoạt động. Hãy chọn cổng khác.');return;}
    const a=deviceById(from),b=deviceById(to),id='link'+(deviceSeq++);
    topo.links.push({id,from,to,fromPort,toPort,name:a.name+' – '+b.name,iface:`${fromPort} ↔ ${toPort}`,cost:10,up:true,kind:'backup'});
    selectedLink=id;renderTopology();
  });
  $('addDeviceBtn').addEventListener('click',()=>{
    const type=$('newDeviceType').value,n=deviceSeq++,id='new'+n;
    const count=topo.devices.length,positions=[[80,285],[260,285],[440,285],[620,285],[780,285]];
    const p=positions[count%positions.length];
    const defaults={pc:['PC mới','192.168.10.'+(100+n)+'/24','Fa0','Máy trạm mới','192.168.10.0/24'],switch:['Switch mới','192.168.10.'+(150+n),'Fa0/1–Fa0/8','Switch truy cập','VLAN mới'],router:['Router mới','10.0.'+n+'.1/24','G0/0','Router mới','10.0.'+n+'.0/24'],server:['Server mới','203.0.113.'+(100+n)+'/24','Fa0','Máy chủ mới','203.0.113.0/24']}[type];
    topo.devices.push({id,type,name:defaults[0],ip:defaults[1],iface:defaults[2],role:defaults[3],subnet:defaults[4],x:p[0],y:p[1]});
    selectedDevice=id;renderTopology();
  });
  $('removeDeviceBtn').addEventListener('click',()=>{
    if(!selectedDevice){alert('Hãy chọn thiết bị cần xóa trên sơ đồ.');return;}
    const d=deviceById(selectedDevice);if(!d)return;
    topo.devices=topo.devices.filter(x=>x.id!==selectedDevice);
    topo.links=topo.links.filter(l=>l.from!==selectedDevice&&l.to!==selectedDevice);
    selectedDevice=topo.devices[0]?.id||null;selectedLink=topo.links[0]?.id||null;renderTopology();
  });
  $('clearTopologyBtn').addEventListener('click',()=>{
    // Xóa trực tiếp thay vì confirm() vì một số môi trường xem file HTML chặn hộp thoại native.
    if(!topo) return;
    topo.devices.length = 0;
    topo.links.length = 0;
    selectedDevice = null;
    selectedLink = null;
    if (NetLab.legacy && typeof NetLab.legacy.reset === 'function') NetLab.legacy.reset();
    else renderTopology();
    const summary = $('topologySummary');
    if (summary) {
      summary.innerHTML = '<div class="topology-empty-state"><b>Đã xóa toàn bộ thiết bị và liên kết.</b><br>Chọn một topology mẫu hoặc thêm thiết bị mới để bắt đầu.</div>';
    }
    $('clearTopologyBtn').textContent = '✓ Đã xóa tất cả';
    setTimeout(() => { const b=$('clearTopologyBtn'); if(b) b.textContent='⌫ Xóa tất cả thiết bị'; }, 1800);
  });

  function syncProxyControls(){
    const auto=$('autoBtn'),autoProxy=$('topologyAutoProxy');
    if(auto&&autoProxy) setTimelineRunning(autoProxy, auto.textContent.indexOf('Tạm dừng') !== -1);
    const prev=$('prevBtn'),next=$('nextBtn');
    const prevProxy=$('topologyPrevProxy'),nextProxy=$('topologyNextProxy');
    if(prevProxy&&prev) prevProxy.disabled=prev.disabled;
    if(nextProxy&&next) nextProxy.disabled=next.disabled;
    const failure=$('failureBtn'),failureProxy=$('topologyFailureProxy');
    if(failure&&failureProxy){
      failureProxy.textContent=failure.textContent;
      failureProxy.disabled=failure.disabled;
      failureProxy.classList.toggle('active', failure.classList.contains('active'));
    }
  }

  function syncFromLegacy(){
    renderTopology();
    const state=legacyState();
    const fill=$('topologyProgressFill');
    if(fill&&state.total>0) fill.style.width=((state.step+1)/state.total*100)+'%';
    const stageNo=$('stageNo'),stageTitle=$('stageTitle'),mirror=$('topologyStageMirror');
    if(mirror&&stageNo&&stageTitle) mirror.textContent=stageNo.textContent+' · '+stageTitle.textContent;
    syncProxyControls();
  }

  [['topologyResetProxy','resetBtn'],['topologyPrevProxy','prevBtn'],['topologyNextProxy','nextBtn'],['topologyAutoProxy','autoBtn'],['topologyFailureProxy','failureBtn']].forEach(pair=>{
    const proxy=$(pair[0]),target=$(pair[1]);
    if(proxy&&target) proxy.addEventListener('click',()=>target.click());
  });

  document.addEventListener('legacy:render', syncFromLegacy);

  // Tự chạy dừng ở bước cuối không phát lại legacy:render, nên theo dõi trực tiếp nhãn của #autoBtn.
  const autoBtn=$('autoBtn');
  if(autoBtn) new MutationObserver(syncProxyControls).observe(autoBtn,{childList:true,subtree:true,characterData:true});

  selectTopology('office');
  syncFromLegacy();

  NetLab.topologyEditor = {
    getState: function () {
      return {
        devices: topo ? topo.devices.length : 0,
        links: topo ? topo.links.length : 0,
        selectedDevice: selectedDevice,
        selectedLink: selectedLink
      };
    },
    sync: syncFromLegacy
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
