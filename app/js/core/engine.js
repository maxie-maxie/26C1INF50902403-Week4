(function (root) {
  var NetLab = root.NetLab = root.NetLab || {};

  var net   = (typeof require !== 'undefined') ? require('./net.js')   : NetLab.net;
  var model = (typeof require !== 'undefined') ? require('./model.js') : NetLab.model;

  var BROADCAST_MAC = 'ff:ff:ff:ff:ff:ff';
  var DEFAULT_TTL   = 64;
  var DELAY_STEP_MS = 10; // mỗi bước mô phỏng cách nhau 10 ms


  function clone(x) { return model.cloneState(x); }

  var _evtCounter = 0;
  function nextEvtId() {
    _evtCounter += 1;
    return 'evt-' + _evtCounter;
  }
  function resetEvtCounter() { _evtCounter = 0; }

  function makeStep(opts) {
    return {
      i:          opts.i,
      tSim:       opts.tSim,
      deviceId:   opts.deviceId,
      linkId:     opts.linkId   || null,
      phase:      opts.phase,
      packet:     opts.packet,
      lookup:     opts.lookup   || null,
      arpOp:      opts.arpOp    || null,
      status:     opts.status   || 'ok',
      stateAfter: opts.stateAfter
    };
  }

  function makeEvent(opts) {
    return {
      id:        nextEvtId(),
      tSim:      opts.tSim,
      type:      opts.type,
      deviceIds: opts.deviceIds || [],
      linkIds:   opts.linkIds   || [],
      severity:  opts.severity  || 'info',
      desc:      opts.desc      || '',
      cause:     opts.cause     || '',
      confirmed: opts.confirmed !== undefined ? opts.confirmed : true,
      stepIndex: opts.stepIndex
    };
  }

  // Trả về { link, aSide } hoặc null. aSide = true nếu src là đầu a.
  function findLinkBetween(topology, devA, devB) {
    var links = topology.links;
    for (var i = 0; i < links.length; i++) {
      var lnk = links[i];
      if (lnk.a.dev === devA && lnk.b.dev === devB) return { link: lnk, aSide: true };
      if (lnk.b.dev === devA && lnk.a.dev === devB) return { link: lnk, aSide: false };
    }
    return null;
  }

  function getIfOnLink(topology, devId, link) {
    var side = (link.a.dev === devId) ? link.a : link.b;
    var dev = model.findDevice(topology, devId);
    return dev ? model.findInterface(dev, side.if) : null;
  }

  // Dùng để router xác định outIf khi nextHop là connected route.
  function findIfForNextHop(topology, routerDev, nextHopIp) {
    for (var i = 0; i < routerDev.interfaces.length; i++) {
      var iface = routerDev.interfaces[i];
      if (iface.up && iface.ip && net.sameSubnet(iface.ip, nextHopIp, iface.prefixLen)) {
        return iface;
      }
    }
    return null;
  }

  function findDirectIf(topology, dev, dstIp) {
    for (var i = 0; i < dev.interfaces.length; i++) {
      var iface = dev.interfaces[i];
      if (iface.up && iface.ip && net.sameSubnet(iface.ip, dstIp, iface.prefixLen)) {
        return iface;
      }
    }
    return null;
  }

  function findDevByIp(topology, ip) {
    for (var i = 0; i < topology.devices.length; i++) {
      var dev = topology.devices[i];
      for (var j = 0; j < dev.interfaces.length; j++) {
        if (dev.interfaces[j].ip === ip) return dev;
      }
    }
    return null;
  }

  function switchesBetween(topology, devAId, devBId) {
    // Tìm link trực tiếp qua switch: devA -- sw -- devB
    var result = [];
    var linksOfA = model.linksOf(topology, devAId);
    for (var i = 0; i < linksOfA.length; i++) {
      var lnk = linksOfA[i];
      var other = (lnk.a.dev === devAId) ? lnk.b.dev : lnk.a.dev;
      var otherDev = model.findDevice(topology, other);
      if (otherDev && otherDev.type === 'switch') {
        // Kiểm tra switch này có nối tới devB không
        var linksOfSw = model.linksOf(topology, other);
        for (var j = 0; j < linksOfSw.length; j++) {
          var swLnk = linksOfSw[j];
          var far = (swLnk.a.dev === other) ? swLnk.b.dev : swLnk.a.dev;
          if (far === devBId) result.push(otherDev);
        }
      }
    }
    return result;
  }

  // ARP broadcast chỉ lan trong L2 segment có kết nối vật lý.
  function hasDirectL2Path(topology, devAId, devBId) {
    // Link trực tiếp
    var direct = findLinkBetween(topology, devAId, devBId);
    if (direct) return true;
    // Qua switch
    var sw = switchesBetween(topology, devAId, devBId);
    return sw.length > 0;
  }

  function vlanAllows(topology, srcIfVlan, dstIfVlan, switches) {
    if (!switches || switches.length === 0) return true;
    // Nếu không có VLAN tag nào → cùng VLAN mặc định, cho phép
    if (srcIfVlan === undefined && dstIfVlan === undefined) return true;
    // Cả hai phải có cùng VLAN
    var sv = srcIfVlan !== undefined ? srcIfVlan : 1;
    var dv = dstIfVlan !== undefined ? dstIfVlan : 1;
    return sv === dv;
  }

  function macOfIf(iface) {
    return iface.mac || net.macFor(iface.id || iface.name, iface.name);
  }

  function lookupArp(topologyState, devId, ip) {
    var dev = model.findDevice(topologyState, devId);
    if (!dev) return null;
    var cache = dev.arpCache || {};
    return cache[ip] || null;
  }

  function arpSetMutation(devId, ip, mac) {
    return { op: 'arp.set', dev: devId, ip: ip, mac: mac };
  }


  function TraceContext(initialState) {
    this.steps    = [];
    this.events   = [];
    this.tSim     = 0;
    this.curState = clone(initialState);
  }

  TraceContext.prototype.tick = function () {
    this.tSim += DELAY_STEP_MS;
    return this.tSim;
  };

  TraceContext.prototype.addStep = function (opts) {
    var t = this.tick();
    var step = makeStep({
      i:          this.steps.length,
      tSim:       t,
      deviceId:   opts.deviceId,
      linkId:     opts.linkId,
      phase:      opts.phase,
      packet:     opts.packet,
      lookup:     opts.lookup,
      arpOp:      opts.arpOp,
      status:     opts.status,
      stateAfter: clone(this.curState)
    });
    this.steps.push(step);
    return step;
  };

  TraceContext.prototype.addEvent = function (opts) {
    opts.stepIndex = this.steps.length; // step hiện tại chưa được commit → index = length
    var evt = makeEvent(opts);
    this.events.push(evt);
    return evt;
  };

  TraceContext.prototype.applyMutation = function (mutation) {
    this.curState = model.applyMutations(this.curState, [mutation]);
  };

  function resolveArp(ctx, srcDevId, srcIf, targetIp, packet) {
    var topology = ctx.curState.topology || ctx.curState;

    // Kiểm tra cache
    var cached = lookupArp(topology, srcDevId, targetIp);
    if (cached) {
      ctx.addEvent({
        tSim:      ctx.tSim,
        type:      'arp.cache.new',
        deviceIds: [srcDevId],
        linkIds:   [],
        severity:  'info',
        desc:      'Tìm thấy MAC trong bộ nhớ ARP: ' + targetIp + ' → ' + cached,
        cause:     'ARP cache hit',
        confirmed: true
      });
      // Bước kiem_tra_arp — cache hit
      ctx.addStep({
        deviceId: srcDevId,
        phase:    'kiem_tra_arp',
        packet:   packet,
        arpOp:    { op: 'query', ip: targetIp, result: 'hit', mac: cached },
        status:   'ok'
      });
      return { mac: cached, cacheHit: true, failed: false };
    }

    // Cache miss — cần gửi ARP request (broadcast)
    ctx.addEvent({
      tSim:      ctx.tSim,
      type:      'arp.request',
      deviceIds: [srcDevId],
      linkIds:   [],
      severity:  'info',
      desc:      'Gửi ARP Request: ai có IP ' + targetIp + '?',
      cause:     'ARP cache miss — cần phân giải địa chỉ MAC',
      confirmed: true
    });

    // Bước kiem_tra_arp — cache miss
    ctx.addStep({
      deviceId: srcDevId,
      phase:    'kiem_tra_arp',
      packet:   packet,
      arpOp:    { op: 'request', ip: targetIp, result: 'miss' },
      status:   'pending'
    });

    // Tìm thiết bị đích có IP tương ứng
    var topo = ctx.curState.topology || ctx.curState;
    var targetDev = findDevByIp(topo, targetIp);
    if (!targetDev) {
      // Không có thiết bị nào có IP này → không có reply
      ctx.addEvent({
        tSim:      ctx.tSim,
        type:      'forward.fail',
        deviceIds: [srcDevId],
        linkIds:   [],
        severity:  'fail',
        desc:      'Không nhận được ARP Reply: không tìm thấy thiết bị với IP ' + targetIp,
        cause:     'Không có thiết bị nào trả lời ARP broadcast',
        confirmed: true
      });
      ctx.addStep({
        deviceId: srcDevId,
        phase:    'bao_loi',
        packet:   packet,
        arpOp:    { op: 'request', ip: targetIp, result: 'no-reply' },
        status:   'fail'
      });
      return { mac: null, cacheHit: false, failed: true, reason: 'no-arp-reply' };
    }

    // Kiểm tra đường L2 vật lý: ARP broadcast chỉ đến được thiết bị có link trực tiếp hoặc qua switch
    if (!hasDirectL2Path(topo, srcDevId, targetDev.id)) {
      ctx.addEvent({
        tSim:      ctx.tSim,
        type:      'forward.fail',
        deviceIds: [srcDevId, targetDev.id],
        linkIds:   [],
        severity:  'fail',
        desc:      'Không nhận được ARP Reply: không có đường L2 trực tiếp đến ' + targetIp,
        cause:     'ARP broadcast chỉ lan truyền trong đoạn mạng L2 có kết nối vật lý',
        confirmed: true
      });
      ctx.addStep({
        deviceId: srcDevId,
        phase:    'bao_loi',
        packet:   packet,
        arpOp:    { op: 'request', ip: targetIp, result: 'no-reply' },
        status:   'fail'
      });
      return { mac: null, cacheHit: false, failed: true, reason: 'no-l2-path' };
    }

    // Kiểm tra VLAN (nếu có switch giữa srcDev và targetDev)
    var switches = switchesBetween(topo, srcDevId, targetDev.id);
    var tgtIf = null;
    for (var i = 0; i < targetDev.interfaces.length; i++) {
      if (targetDev.interfaces[i].ip === targetIp) { tgtIf = targetDev.interfaces[i]; break; }
    }
    if (!vlanAllows(topo, srcIf ? srcIf.vlan : undefined, tgtIf ? tgtIf.vlan : undefined, switches)) {
      ctx.addEvent({
        tSim:      ctx.tSim,
        type:      'forward.fail',
        deviceIds: [srcDevId, targetDev.id],
        linkIds:   [],
        severity:  'fail',
        desc:      'ARP broadcast bị chặn bởi VLAN khác nhau',
        cause:     'VLAN mismatch: ARP broadcast không thể vượt ranh giới VLAN',
        confirmed: true
      });
      ctx.addStep({
        deviceId: srcDevId,
        phase:    'bao_loi',
        packet:   packet,
        arpOp:    { op: 'request', ip: targetIp, result: 'vlan-blocked' },
        status:   'fail'
      });
      return { mac: null, cacheHit: false, failed: true, reason: 'vlan-mismatch' };
    }

    // Kiểm tra link down giữa src và target (hoặc qua switch)
    var linkInfo = findLinkBetween(topo, srcDevId, targetDev.id);
    if (!linkInfo && switches.length > 0) {
      // Qua switch: kiểm tra cả hai đoạn
      var sw = switches[0];
      var lnk1 = findLinkBetween(topo, srcDevId, sw.id);
      var lnk2 = findLinkBetween(topo, sw.id, targetDev.id);
      if ((lnk1 && !lnk1.link.up) || (lnk2 && !lnk2.link.up)) {
        var downId = (lnk1 && !lnk1.link.up) ? lnk1.link.id : lnk2.link.id;
        ctx.addEvent({
          tSim:      ctx.tSim,
          type:      'link.state',
          deviceIds: [srcDevId, targetDev.id],
          linkIds:   [downId],
          severity:  'fail',
          desc:      'Liên kết bị ngắt: ARP broadcast không đến được đích',
          cause:     'Link down trên đường truyền ARP',
          confirmed: true
        });
        ctx.addStep({
          deviceId: srcDevId,
          linkId:   downId,
          phase:    'bao_loi',
          packet:   packet,
          arpOp:    { op: 'request', ip: targetIp, result: 'link-down' },
          status:   'fail'
        });
        return { mac: null, cacheHit: false, failed: true, reason: 'link-down' };
      }
    } else if (linkInfo && !linkInfo.link.up) {
      ctx.addEvent({
        tSim:      ctx.tSim,
        type:      'link.state',
        deviceIds: [srcDevId, targetDev.id],
        linkIds:   [linkInfo.link.id],
        severity:  'fail',
        desc:      'Liên kết bị ngắt: ARP broadcast không đến được đích',
        cause:     'Link down trên đường truyền ARP',
        confirmed: true
      });
      ctx.addStep({
        deviceId: srcDevId,
        linkId:   linkInfo.link.id,
        phase:    'bao_loi',
        packet:   packet,
        arpOp:    { op: 'request', ip: targetIp, result: 'link-down' },
        status:   'fail'
      });
      return { mac: null, cacheHit: false, failed: true, reason: 'link-down' };
    }

    // ARP reply nhận được
    var tgtMac = tgtIf ? macOfIf(tgtIf) : net.macFor(targetDev.id, targetDev.interfaces[0] ? targetDev.interfaces[0].name : 'eth0');

    ctx.addEvent({
      tSim:      ctx.tSim,
      type:      'arp.reply',
      deviceIds: [targetDev.id, srcDevId],
      linkIds:   [],
      severity:  'success',
      desc:      'ARP Reply: ' + targetIp + ' có MAC là ' + tgtMac,
      cause:     'Thiết bị đích phản hồi ARP request',
      confirmed: true
    });

    // Cập nhật ARP cache
    var oldMac = lookupArp(ctx.curState.topology || ctx.curState, srcDevId, targetIp);
    ctx.applyMutation(arpSetMutation(srcDevId, targetIp, tgtMac));
    ctx.addEvent({
      tSim:      ctx.tSim,
      type:      oldMac ? 'arp.cache.changed' : 'arp.cache.new',
      deviceIds: [srcDevId],
      linkIds:   [],
      severity:  'info',
      desc:      'Cập nhật ARP cache: ' + targetIp + ' → ' + tgtMac,
      cause:     'Nhận được ARP Reply',
      confirmed: true
    });

    return { mac: tgtMac, cacheHit: false, failed: false };
  }


  // TTL trên packet này đã được giảm bởi caller nếu srcDev là router.
  function simulateHop(ctx, srcDevId, packet, dstIp) {
    var topo = ctx.curState.topology || ctx.curState;
    var srcDev = model.findDevice(topo, srcDevId);

    if (!srcDev) {
      return { ok: false, reason: 'device-not-found', arrivedAtDst: false };
    }

    var isRouter = (srcDev.type === 'router' || srcDev.type === 'isp' || srcDev.type === 'as-border');

    // Bước 1: xác định đích — kiểm tra có cùng subnet không
    // Lấy interface phù hợp với dstIp (connected)
    var directIf = findDirectIf(topo, srcDev, dstIp);
    var isSameSubnet = (directIf !== null);

    // Bước xac_dinh_dich
    ctx.addEvent({
      tSim:      ctx.tSim,
      type:      'route.lookup',
      deviceIds: [srcDevId],
      linkIds:   [],
      severity:  'info',
      desc:      'Xác định đích: ' + dstIp + (isSameSubnet ? ' (cùng subnet)' : ' (khác subnet)'),
      cause:     'Thiết bị kiểm tra xem đích có trong cùng mạng con không',
      confirmed: true
    });
    ctx.addStep({
      deviceId: srcDevId,
      phase:    'xac_dinh_dich',
      packet:   clone(packet),
      status:   'ok'
    });

    if (isSameSubnet) {
      // Bước kiem_tra_arp: lấy MAC của đích
      var arpResult = resolveArp(ctx, srcDevId, directIf, dstIp, clone(packet));
      if (arpResult.failed) {
        return { ok: false, reason: arpResult.reason, arrivedAtDst: false };
      }

      var dstMac = arpResult.mac;
      var srcMac = macOfIf(directIf);

      // Cập nhật L2 frame
      var newPacket = clone(packet);
      newPacket.l2.srcMac = srcMac;
      newPacket.l2.dstMac = dstMac;

      // Tìm link tới đích
      var dstDev = findDevByIp(topo, dstIp);
      if (!dstDev) {
        ctx.addEvent({
          tSim:      ctx.tSim,
          type:      'forward.fail',
          deviceIds: [srcDevId],
          linkIds:   [],
          severity:  'fail',
          desc:      'Không tìm thấy thiết bị đích với IP ' + dstIp,
          cause:     'Địa chỉ IP đích không tồn tại trong topology',
          confirmed: true
        });
        ctx.addStep({
          deviceId: srcDevId,
          phase:    'bao_loi',
          packet:   newPacket,
          status:   'fail'
        });
        return { ok: false, reason: 'no-dst-device', arrivedAtDst: false };
      }

      // Kiểm tra link
      var linkInfo = findLinkBetween(topo, srcDevId, dstDev.id);
      // Qua switch?
      var swList = switchesBetween(topo, srcDevId, dstDev.id);
      var usedLinkId = null;
      if (!linkInfo && swList.length > 0) {
        var sw0 = swList[0];
        var lnkToSw = findLinkBetween(topo, srcDevId, sw0.id);
        var lnkFromSw = findLinkBetween(topo, sw0.id, dstDev.id);
        if (lnkToSw && !lnkToSw.link.up) {
          ctx.addEvent({
            tSim:      ctx.tSim,
            type:      'link.state',
            deviceIds: [srcDevId],
            linkIds:   [lnkToSw.link.id],
            severity:  'fail',
            desc:      'Liên kết tới switch bị ngắt: ' + lnkToSw.link.id,
            cause:     'Link down trước switch',
            confirmed: true
          });
          ctx.addStep({ deviceId: srcDevId, linkId: lnkToSw.link.id, phase: 'bao_loi', packet: newPacket, status: 'fail' });
          return { ok: false, reason: 'link-down', arrivedAtDst: false };
        }
        if (lnkFromSw && !lnkFromSw.link.up) {
          ctx.addEvent({
            tSim:      ctx.tSim,
            type:      'link.state',
            deviceIds: [sw0.id, dstDev.id],
            linkIds:   [lnkFromSw.link.id],
            severity:  'fail',
            desc:      'Liên kết từ switch đến đích bị ngắt: ' + lnkFromSw.link.id,
            cause:     'Link down sau switch',
            confirmed: true
          });
          ctx.addStep({ deviceId: sw0.id, linkId: lnkFromSw.link.id, phase: 'bao_loi', packet: newPacket, status: 'fail' });
          return { ok: false, reason: 'link-down', arrivedAtDst: false };
        }
        usedLinkId = lnkFromSw ? lnkFromSw.link.id : null;
      } else if (linkInfo) {
        if (!linkInfo.link.up) {
          ctx.addEvent({
            tSim:      ctx.tSim,
            type:      'link.state',
            deviceIds: [srcDevId, dstDev.id],
            linkIds:   [linkInfo.link.id],
            severity:  'fail',
            desc:      'Liên kết đến đích bị ngắt: ' + linkInfo.link.id,
            cause:     'Link down trên đường truyền',
            confirmed: true
          });
          ctx.addStep({ deviceId: srcDevId, linkId: linkInfo.link.id, phase: 'bao_loi', packet: newPacket, status: 'fail' });
          return { ok: false, reason: 'link-down', arrivedAtDst: false };
        }
        usedLinkId = linkInfo.link.id;
      }

      // Gửi frame
      ctx.addEvent({
        tSim:      ctx.tSim,
        type:      'route.active',
        deviceIds: [srcDevId, dstDev.id],
        linkIds:   usedLinkId ? [usedLinkId] : [],
        severity:  'success',
        desc:      'Gửi frame trực tiếp đến ' + dstIp + ' (cùng subnet)',
        cause:     'Giao tiếp L2 trong cùng mạng con',
        confirmed: true
      });
      ctx.addStep({
        deviceId: srcDevId,
        linkId:   usedLinkId,
        phase:    'chuyen_frame_lan',
        packet:   newPacket,
        status:   'ok'
      });

      // Đã đến đích
      ctx.addEvent({
        tSim:      ctx.tSim,
        type:      'route.match',
        deviceIds: [dstDev.id],
        linkIds:   [],
        severity:  'success',
        desc:      'Gói tin đã đến đích: ' + dstIp,
        cause:     'Giao tiếp cùng subnet thành công',
        confirmed: true
      });
      ctx.addStep({
        deviceId: dstDev.id,
        linkId:   usedLinkId,
        phase:    'den_dich_hoac_that_bai',
        packet:   newPacket,
        status:   'ok'
      });

      return { ok: true, arrivedAtDst: true, nextDevId: dstDev.id, packet: newPacket };

    } else {
      // Tra bảng định tuyến
      var rtResult = net.lpm(srcDev.routingTable, dstIp);

      ctx.addEvent({
        tSim:      ctx.tSim,
        type:      'route.lookup',
        deviceIds: [srcDevId],
        linkIds:   [],
        severity:  rtResult.chosen ? 'info' : 'fail',
        desc:      rtResult.chosen
          ? 'Tìm thấy tuyến đường: nextHop=' + (rtResult.chosen.nextHop || 'direct') + ' outIf=' + rtResult.chosen.outIf
          : 'Không tìm thấy tuyến đường đến ' + dstIp,
        cause:     'Tra bảng định tuyến LPM',
        confirmed: true,
        stepIndex: ctx.steps.length
      });

      if (!rtResult.chosen) {
        ctx.addEvent({
          tSim:      ctx.tSim,
          type:      'unreachable',
          deviceIds: [srcDevId],
          linkIds:   [],
          severity:  'fail',
          desc:      'Không có tuyến đường đến ' + dstIp + ' — gói tin bị loại bỏ',
          cause:     'Bảng định tuyến không có mục nào khớp với IP đích',
          confirmed: true
        });
        ctx.addStep({
          deviceId: srcDevId,
          phase:    'bao_loi',
          packet:   clone(packet),
          lookup:   { matched: [], chosen: null, nextHop: null, outIf: null },
          status:   'fail'
        });
        return { ok: false, reason: 'unreachable', arrivedAtDst: false };
      }

      var route = rtResult.chosen;
      var nextHopIp = route.nextHop;
      var outIfName = route.outIf;

      // Bước router_nhan_tra_bang (chỉ áp dụng khi thiết bị hiện tại là router)
      if (isRouter) {
        ctx.addStep({
          deviceId: srcDevId,
          phase:    'router_nhan_tra_bang',
          packet:   clone(packet),
          lookup:   { matched: rtResult.matches, chosen: route, nextHop: nextHopIp, outIf: outIfName },
          status:   'ok'
        });
      }

      // Bước chon_next_hop
      ctx.addEvent({
        tSim:      ctx.tSim,
        type:      'route.match',
        deviceIds: [srcDevId],
        linkIds:   [],
        severity:  'success',
        desc:      'Chọn next hop: ' + (nextHopIp || 'kết nối trực tiếp') + ' qua ' + outIfName,
        cause:     'Tuyến khớp dài nhất (LPM)',
        confirmed: true
      });
      ctx.addStep({
        deviceId: srcDevId,
        phase:    'chon_next_hop',
        packet:   clone(packet),
        lookup:   { matched: rtResult.matches, chosen: route, nextHop: nextHopIp, outIf: outIfName },
        status:   'ok'
      });

      // Xác định outIf object
      var outIface = model.findInterface(srcDev, outIfName);
      if (!outIface) {
        // Thử tìm bằng IP của nextHop
        if (nextHopIp) outIface = findIfForNextHop(topo, srcDev, nextHopIp);
      }

      // Tìm thiết bị next hop
      var nextDev = nextHopIp ? findDevByIp(topo, nextHopIp) : null;

      // Nếu nextHop là null/connected: thiết bị đích nằm cùng subnet với outIf
      if (!nextHopIp || nextHopIp === '' || nextHopIp === null) {
        // Connected route → thực chất là cùng subnet, nhưng được định nghĩa qua route
        nextDev = findDevByIp(topo, dstIp);
      }

      // Tìm link
      var gwLinkInfo = nextDev ? findLinkBetween(topo, srcDevId, nextDev.id) : null;

      // Qua switch?
      var gwSwList = nextDev ? switchesBetween(topo, srcDevId, nextDev.id) : [];
      var gwUsedLink = null;
      if (!gwLinkInfo && gwSwList.length > 0) {
        var gw_sw = gwSwList[0];
        var l1 = findLinkBetween(topo, srcDevId, gw_sw.id);
        var l2 = findLinkBetween(topo, gw_sw.id, nextDev.id);
        if (l1 && !l1.link.up) {
          ctx.addEvent({ tSim: ctx.tSim, type: 'link.state', deviceIds: [srcDevId], linkIds: [l1.link.id], severity: 'fail', desc: 'Liên kết đến switch bị ngắt', cause: 'Link down', confirmed: true });
          ctx.addStep({ deviceId: srcDevId, linkId: l1.link.id, phase: 'bao_loi', packet: clone(packet), status: 'fail' });
          return { ok: false, reason: 'link-down', arrivedAtDst: false };
        }
        if (l2 && !l2.link.up) {
          ctx.addEvent({ tSim: ctx.tSim, type: 'link.state', deviceIds: [gw_sw.id, nextDev.id], linkIds: [l2.link.id], severity: 'fail', desc: 'Liên kết từ switch đến next hop bị ngắt', cause: 'Link down', confirmed: true });
          ctx.addStep({ deviceId: gw_sw.id, linkId: l2.link.id, phase: 'bao_loi', packet: clone(packet), status: 'fail' });
          return { ok: false, reason: 'link-down', arrivedAtDst: false };
        }
        gwUsedLink = l2 ? l2.link.id : null;
      } else if (gwLinkInfo) {
        if (!gwLinkInfo.link.up) {
          ctx.addEvent({ tSim: ctx.tSim, type: 'link.state', deviceIds: [srcDevId, nextDev ? nextDev.id : '?'], linkIds: [gwLinkInfo.link.id], severity: 'fail', desc: 'Liên kết đến next hop bị ngắt: ' + gwLinkInfo.link.id, cause: 'Link down', confirmed: true });
          ctx.addStep({ deviceId: srcDevId, linkId: gwLinkInfo.link.id, phase: 'bao_loi', packet: clone(packet), status: 'fail' });
          return { ok: false, reason: 'link-down', arrivedAtDst: false };
        }
        gwUsedLink = gwLinkInfo.link.id;
      }

      // ARP để lấy MAC của next hop
      var arpTarget = (nextHopIp && nextHopIp !== '') ? nextHopIp : dstIp;
      var arpResultGw = resolveArp(ctx, srcDevId, outIface, arpTarget, clone(packet));
      if (arpResultGw.failed) {
        return { ok: false, reason: arpResultGw.reason, arrivedAtDst: false };
      }

      var gwDstMac = arpResultGw.mac;
      var gwSrcMac = outIface ? macOfIf(outIface) : net.macFor(srcDevId, outIfName);

      // Tạo lại frame (tao_lai_frame nếu là router, chuyen_frame_lan nếu là host→gateway)
      var newPkt = clone(packet);
      newPkt.l2.srcMac = gwSrcMac;
      newPkt.l2.dstMac = gwDstMac;

      ctx.addEvent({
        tSim:      ctx.tSim,
        type:      'route.active',
        deviceIds: [srcDevId],
        linkIds:   gwUsedLink ? [gwUsedLink] : [],
        severity:  'info',
        desc:      'Chuyển tiếp frame đến next hop ' + arpTarget + ' qua ' + outIfName,
        cause:     'Định tuyến L3 — frame được đóng gói lại với MAC mới',
        confirmed: true
      });

      var forwardPhase = isRouter ? 'tao_lai_frame' : 'chuyen_frame_lan';
      ctx.addStep({
        deviceId: srcDevId,
        linkId:   gwUsedLink,
        phase:    forwardPhase,
        packet:   newPkt,
        lookup:   { matched: rtResult.matches, chosen: route, nextHop: nextHopIp, outIf: outIfName },
        status:   'ok'
      });

      // Trả về next hop để vòng lặp tiếp tục
      var nextHopDev = nextHopIp ? findDevByIp(topo, nextHopIp) : null;
      if (!nextHopDev) nextHopDev = nextDev;

      return {
        ok:           true,
        arrivedAtDst: false,
        nextDevId:    nextHopDev ? nextHopDev.id : null,
        packet:       newPkt
      };
    }
  }

  function routerForward(ctx, routerDevId, packet, dstIp) {
    var topo = ctx.curState.topology || ctx.curState;
    var routerDev = model.findDevice(topo, routerDevId);

    if (!routerDev) return { ok: false, reason: 'router-not-found', arrivedAtDst: false };

    // Nhận frame — router_nhan_tra_bang sẽ được thêm bởi simulateHop bên dưới
    // Giảm TTL
    var ttlBefore = packet.l3.ttlAfter;
    var ttlAfter  = ttlBefore - 1;

    var newPkt = clone(packet);
    newPkt.l3.ttlBefore = ttlBefore;
    newPkt.l3.ttlAfter  = ttlAfter;

    if (ttlAfter <= 0) {
      ctx.addEvent({
        tSim:      ctx.tSim,
        type:      'ttl.expired',
        deviceIds: [routerDevId],
        linkIds:   [],
        severity:  'fail',
        desc:      'TTL hết hạn tại router ' + routerDevId + ' — gói tin bị loại bỏ',
        cause:     'TTL giảm về 0: có thể có vòng lặp định tuyến',
        confirmed: false // nghi vấn
      });
      ctx.addStep({
        deviceId: routerDevId,
        phase:    'bao_loi',
        packet:   newPkt,
        status:   'fail'
      });
      return { ok: false, reason: 'ttl.expired', arrivedAtDst: false };
    }

    // Tra bảng định tuyến và chuyển tiếp
    var rtResult = net.lpm(routerDev.routingTable, dstIp);

    // Bước router_nhan_tra_bang
    ctx.addStep({
      deviceId: routerDevId,
      phase:    'router_nhan_tra_bang',
      packet:   newPkt,
      lookup:   rtResult.chosen
        ? { matched: rtResult.matches, chosen: rtResult.chosen, nextHop: rtResult.chosen.nextHop, outIf: rtResult.chosen.outIf }
        : { matched: [], chosen: null, nextHop: null, outIf: null },
      status:   rtResult.chosen ? 'ok' : 'fail'
    });

    if (!rtResult.chosen) {
      ctx.addEvent({
        tSim:      ctx.tSim,
        type:      'unreachable',
        deviceIds: [routerDevId],
        linkIds:   [],
        severity:  'fail',
        desc:      'Router ' + routerDevId + ' không có tuyến đến ' + dstIp,
        cause:     'Bảng định tuyến không khớp — unreachable',
        confirmed: true
      });
      ctx.addStep({
        deviceId: routerDevId,
        phase:    'bao_loi',
        packet:   newPkt,
        status:   'fail'
      });
      return { ok: false, reason: 'unreachable', arrivedAtDst: false };
    }

    var route = rtResult.chosen;
    var nextHopIp = route.nextHop;
    var outIfName = route.outIf;
    var outIface  = model.findInterface(routerDev, outIfName);
    if (!outIface && nextHopIp) outIface = findIfForNextHop(topo, routerDev, nextHopIp);

    // Bước chon_next_hop
    ctx.addEvent({
      tSim:      ctx.tSim,
      type:      'route.match',
      deviceIds: [routerDevId],
      linkIds:   [],
      severity:  'success',
      desc:      'Router chọn next hop: ' + (nextHopIp || 'direct') + ' qua cổng ' + outIfName,
      cause:     'LPM tìm được tuyến phù hợp',
      confirmed: true
    });
    ctx.addStep({
      deviceId: routerDevId,
      phase:    'chon_next_hop',
      packet:   newPkt,
      lookup:   { matched: rtResult.matches, chosen: route, nextHop: nextHopIp, outIf: outIfName },
      status:   'ok'
    });

    // Xác định thiết bị next hop
    var nextDev = nextHopIp ? findDevByIp(topo, nextHopIp) : findDevByIp(topo, dstIp);
    var isFinalHop = nextDev && !nextHopIp; // connected: đích ở cùng subnet

    // Nếu đây là hop cuối (connected route đến đích), xác định đích
    var finalDst = null;
    if (!nextHopIp || nextHopIp === '') {
      finalDst = findDevByIp(topo, dstIp);
      nextDev  = finalDst;
    }

    // Kiểm tra link đến next hop
    var linkToNext = nextDev ? findLinkBetween(topo, routerDevId, nextDev.id) : null;
    var swListR = nextDev ? switchesBetween(topo, routerDevId, nextDev.id) : [];
    var usedLinkR = null;

    if (!linkToNext && swListR.length > 0) {
      var sw_r = swListR[0];
      var lr1 = findLinkBetween(topo, routerDevId, sw_r.id);
      var lr2 = findLinkBetween(topo, sw_r.id, nextDev.id);
      if (lr1 && !lr1.link.up) {
        ctx.addEvent({ tSim: ctx.tSim, type: 'link.state', deviceIds: [routerDevId], linkIds: [lr1.link.id], severity: 'fail', desc: 'Liên kết từ router đến switch bị ngắt', cause: 'Link down', confirmed: true });
        ctx.addStep({ deviceId: routerDevId, linkId: lr1.link.id, phase: 'bao_loi', packet: newPkt, status: 'fail' });
        return { ok: false, reason: 'link-down', arrivedAtDst: false };
      }
      if (lr2 && !lr2.link.up) {
        ctx.addEvent({ tSim: ctx.tSim, type: 'link.state', deviceIds: [sw_r.id, nextDev.id], linkIds: [lr2.link.id], severity: 'fail', desc: 'Liên kết từ switch đến next hop bị ngắt', cause: 'Link down', confirmed: true });
        ctx.addStep({ deviceId: sw_r.id, linkId: lr2.link.id, phase: 'bao_loi', packet: newPkt, status: 'fail' });
        return { ok: false, reason: 'link-down', arrivedAtDst: false };
      }
      usedLinkR = lr2 ? lr2.link.id : null;
    } else if (linkToNext) {
      if (!linkToNext.link.up) {
        ctx.addEvent({ tSim: ctx.tSim, type: 'link.state', deviceIds: [routerDevId, nextDev.id], linkIds: [linkToNext.link.id], severity: 'fail', desc: 'Liên kết đến next hop bị ngắt: ' + linkToNext.link.id, cause: 'Link down', confirmed: true });
        ctx.addStep({ deviceId: routerDevId, linkId: linkToNext.link.id, phase: 'bao_loi', packet: newPkt, status: 'fail' });
        return { ok: false, reason: 'link-down', arrivedAtDst: false };
      }
      usedLinkR = linkToNext.link.id;
    }

    // ARP cho next hop
    var arpTargetR = (nextHopIp && nextHopIp !== '') ? nextHopIp : dstIp;
    var arpRes = resolveArp(ctx, routerDevId, outIface, arpTargetR, newPkt);
    if (arpRes.failed) {
      return { ok: false, reason: arpRes.reason, arrivedAtDst: false };
    }

    // Tạo lại frame
    var routerSrcMac = outIface ? macOfIf(outIface) : net.macFor(routerDevId, outIfName);
    var finalPkt = clone(newPkt);
    finalPkt.l2.srcMac = routerSrcMac;
    finalPkt.l2.dstMac = arpRes.mac;

    ctx.addEvent({
      tSim:      ctx.tSim,
      type:      'route.active',
      deviceIds: [routerDevId],
      linkIds:   usedLinkR ? [usedLinkR] : [],
      severity:  'success',
      desc:      'Router tạo lại frame và gửi đến ' + arpTargetR,
      cause:     'Đóng gói lại L2 sau định tuyến L3',
      confirmed: true
    });
    ctx.addStep({
      deviceId: routerDevId,
      linkId:   usedLinkR,
      phase:    'tao_lai_frame',
      packet:   finalPkt,
      lookup:   { matched: rtResult.matches, chosen: route, nextHop: nextHopIp, outIf: outIfName },
      status:   'ok'
    });

    // Nếu đây là hop đến đích cuối
    if (!nextHopIp || nextHopIp === '') {
      // Frame đến đích
      if (nextDev) {
        ctx.addEvent({
          tSim:      ctx.tSim,
          type:      'route.match',
          deviceIds: [nextDev.id],
          linkIds:   [],
          severity:  'success',
          desc:      'Gói tin đã đến đích ' + dstIp,
          cause:     'Chuyển tiếp thành công qua router',
          confirmed: true
        });
        ctx.addStep({
          deviceId: nextDev.id,
          linkId:   usedLinkR,
          phase:    'den_dich_hoac_that_bai',
          packet:   finalPkt,
          status:   'ok'
        });
      }
      return { ok: true, arrivedAtDst: true, nextDevId: nextDev ? nextDev.id : null, packet: finalPkt };
    }

    return { ok: true, arrivedAtDst: false, nextDevId: nextDev ? nextDev.id : null, packet: finalPkt };
  }

  function buildArpTrace(state, action) {
    resetEvtCounter();
    var ctx = new TraceContext(state);
    var topo = ctx.curState.topology || ctx.curState;
    var fromDev = model.findDevice(topo, action.from);

    if (!fromDev) {
      return {
        steps:  ctx.steps,
        events: ctx.events,
        result: { status: 'fail', reason: 'source-not-found' }
      };
    }

    var srcIf = fromDev.interfaces[0] || null;
    var initPacket = {
      l2: { srcMac: srcIf ? macOfIf(srcIf) : BROADCAST_MAC, dstMac: BROADCAST_MAC },
      l3: { srcIp: srcIf ? (srcIf.ip || '') : '', dstIp: action.targetIp, ttlBefore: 0, ttlAfter: 0, proto: 'arp' }
    };

    var arpRes = resolveArp(ctx, action.from, srcIf, action.targetIp, initPacket);

    return {
      steps:  ctx.steps,
      events: ctx.events,
      result: arpRes.failed
        ? { status: 'fail', reason: arpRes.reason }
        : { status: 'ok',   mac: arpRes.mac,   cacheHit: arpRes.cacheHit }
    };
  }

  function buildPingTrace(state, action) {
    resetEvtCounter();
    var ctx = new TraceContext(state);
    var ttl = (typeof action.ttl === 'number' && action.ttl > 0) ? action.ttl : DEFAULT_TTL;

    var topo = ctx.curState.topology || ctx.curState;
    var fromDev = model.findDevice(topo, action.from);
    var toDev   = model.findDevice(topo, action.to);

    if (!fromDev || !toDev) {
      return {
        steps:  ctx.steps,
        events: ctx.events,
        result: { status: 'fail', reason: fromDev ? 'dst-not-found' : 'src-not-found' }
      };
    }

    // Lấy IP src / dst
    var srcIf = fromDev.interfaces[0] || null;
    for (var ki = 0; ki < fromDev.interfaces.length; ki++) {
      if (fromDev.interfaces[ki].ip) { srcIf = fromDev.interfaces[ki]; break; }
    }
    var dstIp = null;
    for (var di = 0; di < toDev.interfaces.length; di++) {
      if (toDev.interfaces[di].ip) { dstIp = toDev.interfaces[di].ip; break; }
    }

    if (!dstIp) {
      return {
        steps:  ctx.steps,
        events: ctx.events,
        result: { status: 'fail', reason: 'dst-no-ip' }
      };
    }

    var srcIp = srcIf ? (srcIf.ip || '') : '';

    var reqPacket = {
      l2: {
        srcMac: srcIf ? macOfIf(srcIf) : net.macFor(action.from, 'eth0'),
        dstMac: BROADCAST_MAC
      },
      l3: { srcIp: srcIp, dstIp: dstIp, ttlBefore: ttl, ttlAfter: ttl, proto: 'icmp' }
    };

    var curDevId = action.from;
    var curPkt   = reqPacket;
    var requestOk = false;
    var visited   = {};  // vòng lặp phát hiện
    var maxHops   = ttl + 2; // không vượt quá TTL + buffer nhỏ

    for (var hop = 0; hop < maxHops; hop++) {
      if (visited[curDevId]) {
        // Vòng lặp — đã đến router này rồi
        ctx.addEvent({
          tSim:      ctx.tSim,
          type:      'ttl.expired',
          deviceIds: [curDevId],
          linkIds:   [],
          severity:  'fail',
          desc:      'Phát hiện vòng lặp định tuyến — TTL hết hạn',
          cause:     'Gói tin đi theo vòng tròn',
          confirmed: false
        });
        ctx.addStep({ deviceId: curDevId, phase: 'bao_loi', packet: clone(curPkt), status: 'fail' });
        break;
      }
      visited[curDevId] = true;

      var curDev = model.findDevice(ctx.curState.topology || ctx.curState, curDevId);
      if (!curDev) break;

      var isRtr = (curDev.type === 'router' || curDev.type === 'isp' || curDev.type === 'as-border');

      var hopResult;
      if (isRtr) {
        hopResult = routerForward(ctx, curDevId, curPkt, dstIp);
      } else {
        hopResult = simulateHop(ctx, curDevId, curPkt, dstIp);
      }

      if (!hopResult.ok) break;
      if (hopResult.arrivedAtDst) { requestOk = true; break; }

      curDevId = hopResult.nextDevId;
      curPkt   = hopResult.packet;

      if (!curDevId) break;
    }

    var replyOk = false;
    var finalResult;

    if (requestOk) {
      // Đảo chiều: from = action.to, to = action.from
      ctx.addEvent({
        tSim:      ctx.tSim,
        type:      'route.active',
        deviceIds: [action.to, action.from],
        linkIds:   [],
        severity:  'info',
        desc:      'Bắt đầu chặng phản hồi ICMP Echo Reply',
        cause:     'Gói tin đến đích, chuẩn bị gửi phản hồi',
        confirmed: true
      });

      var replyTtl   = DEFAULT_TTL;
      var replyDstIp = srcIp;

      // Lấy srcIp cho reply (IP của toDev)
      var toSrcIf = toDev.interfaces[0] || null;
      for (var ri = 0; ri < toDev.interfaces.length; ri++) {
        if (toDev.interfaces[ri].ip) { toSrcIf = toDev.interfaces[ri]; break; }
      }
      var replyFromIp = toSrcIf ? toSrcIf.ip : '';

      var replyPkt = {
        l2: {
          srcMac: toSrcIf ? macOfIf(toSrcIf) : net.macFor(action.to, 'eth0'),
          dstMac: BROADCAST_MAC
        },
        l3: { srcIp: replyFromIp, dstIp: replyDstIp, ttlBefore: replyTtl, ttlAfter: replyTtl, proto: 'icmp' }
      };

      var replyCurDevId = action.to;
      var replyCurPkt   = replyPkt;
      var replyVisited  = {};

      for (var rHop = 0; rHop < maxHops; rHop++) {
        if (replyVisited[replyCurDevId]) {
          ctx.addEvent({ tSim: ctx.tSim, type: 'ttl.expired', deviceIds: [replyCurDevId], linkIds: [], severity: 'fail', desc: 'Phát hiện vòng lặp trên chặng về', cause: 'Vòng lặp định tuyến', confirmed: false });
          ctx.addStep({ deviceId: replyCurDevId, phase: 'bao_loi', packet: clone(replyCurPkt), status: 'fail' });
          break;
        }
        replyVisited[replyCurDevId] = true;

        var repDev = model.findDevice(ctx.curState.topology || ctx.curState, replyCurDevId);
        if (!repDev) break;

        var repIsRtr = (repDev.type === 'router' || repDev.type === 'isp' || repDev.type === 'as-border');

        var repHopResult;
        if (repIsRtr) {
          repHopResult = routerForward(ctx, replyCurDevId, replyCurPkt, replyDstIp);
        } else {
          repHopResult = simulateHop(ctx, replyCurDevId, replyCurPkt, replyDstIp);
        }

        if (!repHopResult.ok) break;
        if (repHopResult.arrivedAtDst) { replyOk = true; break; }

        replyCurDevId = repHopResult.nextDevId;
        replyCurPkt   = repHopResult.packet;
        if (!replyCurDevId) break;
      }

      if (replyOk) {
        finalResult = { status: 'ok' };
        ctx.addEvent({
          tSim:      ctx.tSim,
          type:      'recovered',
          deviceIds: [action.from],
          linkIds:   [],
          severity:  'success',
          desc:      'Ping thành công: nhận được ICMP Echo Reply',
          cause:     'Cả hai chiều đều thông suốt',
          confirmed: true
        });
        ctx.addStep({
          deviceId: action.from,
          phase:    'den_dich_hoac_that_bai',
          packet:   replyCurPkt,
          status:   'ok'
        });
      } else {
        finalResult = { status: 'không nhận được phản hồi' };
        ctx.addEvent({
          tSim:      ctx.tSim,
          type:      'forward.fail',
          deviceIds: [action.to, action.from],
          linkIds:   [],
          severity:  'fail',
          desc:      'Không nhận được phản hồi ICMP Echo Reply',
          cause:     'Chặng về thất bại (thiếu tuyến về, link down, hoặc lỗi khác)',
          confirmed: false
        });
        ctx.addStep({
          deviceId: action.from,
          phase:    'den_dich_hoac_that_bai',
          packet:   replyCurPkt || replyPkt,
          status:   'fail'
        });
      }
    } else {
      finalResult = { status: 'fail' };
    }

    return {
      steps:  ctx.steps,
      events: ctx.events,
      result: finalResult
    };
  }


  /**
   * Xây dựng trace đầy đủ cho một hành động.
   * @param {object} state  - Trạng thái topology (kết quả của createTopology hoặc applyMutations)
   * @param {object} action - { type: 'ping'|'arp', from, to?, targetIp?, ttl? }
   * @returns {Trace} { steps[], events[], result }
   */
  function build(state, action) {
    if (!state || typeof state !== 'object') throw new Error('engine.build: state phải là object');
    if (!action || typeof action.type !== 'string') throw new Error('engine.build: action.type là bắt buộc');

    if (action.type === 'arp') {
      if (!action.from) throw new Error('engine.build: action.from là bắt buộc cho arp');
      if (!action.targetIp) throw new Error('engine.build: action.targetIp là bắt buộc cho arp');
      return buildArpTrace(state, action);
    }

    if (action.type === 'ping') {
      if (!action.from) throw new Error('engine.build: action.from là bắt buộc cho ping');
      if (!action.to)   throw new Error('engine.build: action.to là bắt buộc cho ping');
      return buildPingTrace(state, action);
    }

    throw new Error('engine.build: action.type không hợp lệ: ' + action.type);
  }


  function createPlayer(trace, opts) {
    if (!trace || !Array.isArray(trace.steps)) throw new Error('createPlayer: trace không hợp lệ');
    opts = opts || {};
    var onStep = (typeof opts.onStep === 'function') ? opts.onStep : function () {};

    var _index   = 0;
    var _timer   = null;
    var _playing = false;
    var _length  = trace.steps.length;

    function _notify() {
      if (_index >= 0 && _index < _length) {
        onStep(trace.steps[_index]);
      }
    }

    function stepForward() {
      if (_index < _length - 1) {
        _index += 1;
        _notify();
      }
    }

    function stepBack() {
      if (_index > 0) {
        _index -= 1;
        _notify();
      }
    }

    function seek(i) {
      var idx = Math.max(0, Math.min(_length - 1, i));
      _index = idx;
      _notify();
    }

    function reset() {
      pause();
      _index = 0;
      if (_length > 0) _notify();
    }

    function pause() {
      _playing = false;
      if (_timer !== null) {
        clearInterval(_timer);
        _timer = null;
      }
    }

    function play(speedMs) {
      if (_playing) return;
      if (_index >= _length - 1) { _index = 0; }
      _playing = true;
      var interval = (typeof speedMs === 'number' && speedMs > 0) ? speedMs : 500;
      _timer = setInterval(function () {
        if (!_playing || _index >= _length - 1) {
          pause();
          return;
        }
        _index += 1;
        _notify();
      }, interval);
    }

    return {
      play:        play,
      pause:       pause,
      stepForward: stepForward,
      stepBack:    stepBack,
      seek:        seek,
      reset:       reset,
      get index()  { return _index; },
      get length() { return _length; }
    };
  }

  var api = { build: build, createPlayer: createPlayer };

  NetLab.engine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
