/* Screen order + presenter notes. Single source for index.html, presenter.html
   and cheatsheet.html. target = seconds on this screen (SPEC-v3 §3).
   v3 story flow: every stop screen has a problem (top strip) and a but (last
   reveal, the transition to the next stop); history is an optional spoken anchor.
   screen + part pick a shared renderer (CN.screens[screen || id]) and its panel. */
(function (G) {
  'use strict';
  var CN = G.CN = G.CN || {};

  var topics = [
    null,
    { n: 1, short: 'Services & framing', map: 'Services &\nframing' },
    { n: 2, short: 'Hamming code', map: 'Hamming\ncode' },
    { n: 3, short: 'CRC', map: 'CRC' },
    { n: 4, short: 'Stop-and-wait', map: 'Simplex &\nstop-and-wait' },
    { n: 5, short: 'GBN vs SR', map: 'Go-Back-N\nvs SR' },
    { n: 6, short: 'Channel allocation & ALOHA', map: 'ALOHA' },
    { n: 7, short: 'CSMA/CD & Ethernet', map: 'CSMA/CD &\nEthernet' },
    { n: 8, short: 'Collision-free', map: 'Collision-\nfree' },
    { n: 9, short: 'Wireless LAN & 802.11', map: 'Wireless &\n802.11' },
    { n: 10, short: 'Switching & devices', map: 'Bridges &\nswitches' },
    { n: 11, short: 'Flooding & Dijkstra', map: 'Flooding &\nDijkstra' },
    { n: 12, short: 'Distance vector', map: 'Distance\nvector' },
    { n: 13, short: 'Link state', map: 'Link\nstate' },
    { n: 14, short: 'Congestion control', map: 'Congestion\ncontrol' },
    { n: 15, short: 'Internetworking & IP', map: 'Internetworking\n& IP' },
    { n: 16, short: 'UDP vs TCP', map: 'UDP vs\nTCP' },
    { n: 17, short: 'Connect & release', map: 'Connect &\nrelease' },
    { n: 18, short: 'Flow control', map: 'Flow\ncontrol' },
    { n: 19, short: 'Timer management', map: 'Timers' },
    { n: 20, short: 'TCP congestion control', map: 'TCP\ncongestion' },
    { n: 21, short: 'DNS', map: 'DNS' },
    { n: 22, short: 'WWW, HTTP & CDN', map: 'Web, HTTP\n& CDN' },
    { n: 23, short: 'E-mail', map: 'E-mail' },
    { n: 24, short: 'Classical ciphers', map: 'Classical\nciphers' },
    { n: 25, short: 'RSA & public key', map: 'RSA &\npublic key' }
  ];

  var acts = [
    null,
    { n: 1, name: 'One link', q: 'How do two machines on one wire exchange frames reliably and efficiently?' },
    { n: 2, name: 'Shared channel', q: 'When many stations share one medium, who talks?' },
    { n: 3, name: 'Many LANs', q: 'How do we join LANs without merging all their traffic?' },
    { n: 4, name: 'Finding a path', q: 'Which way should a router send a packet, and how does it learn?' },
    { n: 5, name: 'Too much traffic', q: 'What happens when the best routes are full?' },
    { n: 6, name: 'Many networks', q: 'How does a packet cross networks that differ in everything?' },
    { n: 7, name: 'End to end', q: 'How do two programs get a reliable byte stream over an unreliable network?' },
    { n: 8, name: 'Names, pages and secrets', q: 'How do people use the network, and how do they trust it?' }
  ];

  var screens = [
    {
      id: 'title', title: '', target: 0,
      syllabus: 'CSPC501 Computer Networks · Units II – V',
      live: 'Wait for the room. The talk timer starts when you press → (or Start here). Open the quiz sidebar (J) and invite the professor too: "Professor, the phone quiz is open to you as well: scan the code and play along."',
      click: '→ to start. P opens this window. F for fullscreen. On any sim: E your numbers, ? predict (where offered), A motion on/off. On a ★ sim: drag or tap a handle, [ ] nudge it, C challenge (C again solves it, a third C closes).'
    },
    {
      id: 'hook', title: 'Hook + journey map', target: 20,
      syllabus: 'Unit II: Data Link · Unit III: Network · Unit IV: Transport · Unit V: Application',
      live: "\"Your phone wants to send 'Hi' to a server in another country. A wire can only carry bits. It doesn't know where a message starts, whether a bit got flipped, who else is talking, or where the server is. Everything in Units II to V exists because the previous fix broke something. Let's follow the message.\"",
      click: '→ reveals the Unit II stops, → Unit III, → Units IV–V, → the But…, → S1.',
      but: 'First problem: the receiver sees one endless stream of bits.'
    },

    /* ---------- Act 1 · One link ---------- */
    {
      id: 't1', topic: 1, stop: '1', act: 1, short: 'Services & framing', title: 'Design issues: services & framing', target: 25,
      subs: [
        { id: 't1', part: 'services', stop: '1a', short: 'Services', title: 'Data link services', click: 'Static: the three services.' },
        { id: 't1b', part: 'count', stop: '1b', short: 'Byte count', title: 'Framing: byte count', click: 'Step corrupts the 2nd count (Fig 3-3).' },
        { id: 't1c', part: 'bytes', stop: '1c', short: 'Byte stuffing', title: 'Framing: byte stuffing (PPP)', click: 'Step shows the receiver removing the ESC (Fig 3-4).' },
        { id: 't1d', part: 'bits', stop: '1d', short: 'Bit stuffing', title: 'Framing: bit stuffing (HDLC, USB)', click: 'Step shows the receiver destuffing (Fig 3-5).' }
      ],
      syllabus: 'Design Issues – Services, Framing, Error Control, Flow Control',
      problem: 'The wire delivers an endless bit stream. Where does a frame start and end?',
      but: 'The frame is found, but noise flipped a bit inside it.',
      live: '"The data link layer offers the layer above one of three services, but first it must cut the stream into frames. Counting bytes fails: one bad count and every later frame is wrong. So mark the edges with a flag, 01111110. If my data happens to contain six ones, the sender stuffs a zero after every five, so six ones can only ever mean a flag. But now the receiver has a frame, and noise has flipped a bit inside it."',
      click: 'Bit stuffing tab is open with Fig 3-5. Toggle "Receiver view" to destuff. Byte tabs have the Fig 3-4 presets.',
      facts: [
        'Services: unacknowledged connectionless (Ethernet) · acknowledged connectionless (802.11) · acknowledged connection-oriented (numbered frames, exactly once, in order).',
        'Framing: byte count · flag bytes + byte stuffing · flag bits + bit stuffing · physical-layer coding violations. Byte count fails: one bad count desynchronises every later frame.',
        'Byte stuffing (PPP): ESC before any FLAG or ESC in the data; receiver removes it.',
        'Bit stuffing (HDLC, USB): flag 01111110; after five 1s insert 0; receiver deletes the 0 after five 1s.',
        'Error control = ACKs, timers, sequence numbers. Flow control = feedback-based (DLL) or rate-based. (Named here; shown in S4–S5.)'
      ],
      example: '011011111111111111110010 → 011011111011111011111010010 · A ESC FLAG B → A ESC ESC ESC FLAG B',
      qa: [
        ['Why stuff after five 1s, not six?', 'The flag has six 1s in a row; stuffing after five means data never does.'],
        ['How does the receiver tell a stuffed 0 from data?', 'After five 1s: a 0 → it was stuffed, delete it; a 1 → a flag (if a 0 follows) or an error.']
      ]
    },
    {
      id: 't2', topic: 2, stop: '2', act: 1, hero: true, short: 'Hamming code', title: 'Hamming code', target: 50,
      subs: [
        { id: 't2', part: 'encode', stop: '2a', short: 'Hamming encode', title: 'Hamming code: building the codeword', click: 'Step computes P1, P2, P4, P8 in turn and lights what each covers. ← undoes. Tap a data bit to flip it (the codeword follows). E: other data bits (1–16).' },
        { id: 't2b', part: 'correct', stop: '2b', short: 'Hamming correct', title: 'Hamming code: find and fix the error', click: 'Tap up to two bits to flip them, or Step flips bit 5. Next Step corrects. The 2nd flip is the break: the syndrome names a bit nobody flipped. C: challenge. E: other data bits (1–16).' }
      ],
      syllabus: 'Error Detection and Correction Codes, Hamming Code',
      problem: 'A bit flipped in transit. Can the receiver find and fix it without asking again?',
      but: 'Correcting costs check bits on every block. On a clean link, detecting and resending is cheaper, and real errors come in bursts.',
      history: 'Richard Hamming, Bell Labs, published 1950. His weekend jobs kept aborting on errors the machine could detect but not fix.',
      live: '"In 1950 Richard Hamming was tired of his machine detecting errors and then just giving up, so he asked: why can\'t it find the error itself? Take the letter A: seven data bits, with check bits at positions 1, 2, 4 and 8. Professor, pick any bit to corrupt. … Checks 1 and 4 fail, 1 + 4 = 5, and bit 5 is the culprit. The syndrome spells out the error position in binary. But those check bits ride on every block. On a clean link, sending one parity bit and occasionally resending costs a fifth as much, and real noise comes in bursts. So most links just detect."',
      click: 'Click a bit in the Received row to flip it. Click a check bit in the Sent row to show what it covers. "Correct" fixes it. R resets.',
      facts: [
        'n = m + r. Detect d errors → distance d+1; correct d → 2d+1.',
        '(m + r + 1) ≤ 2^r: m=4 → r=3 (7,4); m=7 → r=4 (11,7); m=1000 → r=10.',
        'Positions 1…n from the left; powers of 2 are check bits; each enforces even parity over positions whose binary expansion includes it (11 = 1+2+8).',
        'Syndrome = sum of failing check positions = position of the bad bit (0 = no error).',
        'Corrects ONE error. Two errors → syndrome blames an innocent bit.',
        'Cost (the But…): 1 Mbit in 1000-bit blocks, error rate 10⁻⁶: Hamming 10,000 check bits; one parity bit per block + one resent block 2,001.'
      ],
      example: "'A' 1000001 → 00100001001. Flip bit 5 → checks 1, 4 fail → syndrome 0101 = 5. Flip 2 and 6 → syndrome 4 (wrong).",
      qa: [
        ['Why check bits at powers of 2?', 'A power of 2 has a single 1 bit, so each check bit is covered only by itself and every data position by a unique set of checks. That is why the syndrome equals the position.'],
        ['What if two bits flip?', 'Demo: flip 2 and 6 → syndrome 4, the wrong bit. An extra overall parity bit (SEC-DED) detects doubles.'],
        ['So when is correction used?', 'On noisy links where a retransmission would probably be corrupted too (wireless), or where there is no return channel. That is FEC.']
      ]
    },
    {
      id: 't3', topic: 3, stop: '3', act: 1, hero: true, short: 'CRC', title: 'Cyclic Redundancy Check', target: 45,
      subs: [
        { id: 't3', part: 'divide', stop: '3a', short: 'CRC sender', title: 'CRC: the sender divides', click: 'Step adds one XOR row of the long division. ← undoes. Tap a message bit to flip it. E: message / generator.' },
        { id: 't3b', part: 'check', stop: '3b', short: 'CRC receiver', title: 'CRC: the receiver checks', click: 'Start and Length move the burst Step sends (default bits 4–6). Length r + 1 is the break: the burst is G shifted, remainder 0. C: challenge. E: message / generator.' }
      ],
      syllabus: 'Cyclic Redundancy Check',
      problem: 'We need a cheap, strong detector that catches bursts.',
      but: 'CRC can only say "bad frame", and the receiver drops it. The sender doesn\'t even know.',
      live: '"So: detect cheaply, and catch bursts. CRC treats the frame as a polynomial. This is Tanenbaum\'s own example: append four zeros, divide by x⁴+x+1 using XOR, and the remainder 0010 rides along. Corrupt any burst up to 4 bits and the remainder comes out non-zero. The only errors it misses are multiples of the generator. Here\'s one. Every Ethernet card computes CRC-32 on every frame. But CRC only says \'bad frame\', and the receiver throws it away. The sender never finds out."',
      click: 'S steps the division ("Show all" for everything). In the receiver: click bits or use Burst, then "Undetectable error".',
      facts: [
        'Bit strings are polynomials over mod 2 (add = subtract = XOR).',
        'G(x) degree r; high- and low-order bits must be 1.',
        'Sender: append r zeros (xʳM(x)), divide by G mod 2, append remainder: T(x) = xʳM(x) − R(x), divisible by G.',
        'Receiver divides; non-zero remainder = error. Undetected iff G(x) divides E(x).',
        'Catches: all single-bit; all double-bit if G does not divide xᵏ+1; any odd number if (x+1) | G; all bursts ≤ r (r+1 slips with 1/2^(r−1), longer with 1/2^r).',
        'Ethernet (802) uses CRC-32; catches all bursts ≤ 32 bits.'
      ],
      example: '1101011111 / 10011 (x⁴+x+1) → remainder 0010 → frame 11010111110010.',
      qa: [
        ['Why append r zeros?', 'It multiplies M(x) by xʳ, making room for the r-bit remainder.'],
        ['Why must G end in 1?', 'So G cannot divide xⁱ, which guarantees every single-bit error is caught.'],
        ['Can CRC correct errors?', 'It is used to detect only; recovery is by retransmission, which is the next stop.']
      ]
    },
    {
      id: 't4', topic: 4, stop: '4', act: 1, short: 'Stop-and-wait', title: 'Simplex & stop-and-wait', target: 20,
      subs: [
        { id: 't4', part: 'p1', stop: '4a', short: 'Protocol 1', title: 'Protocol 1: utopian simplex', click: 'Step runs to the next event. Click a message in flight to destroy it.' },
        { id: 't4b', part: 'p2', stop: '4b', short: 'Protocol 2', title: 'Protocol 2: simplex stop-and-wait', click: 'Step runs to the next event. Click a message in flight to destroy it.' },
        { id: 't4c', part: 'p3', stop: '4c', short: 'Protocol 3', title: 'Protocol 3: stop-and-wait on a noisy channel (PAR / ARQ)', click: 'Scripted: frame 1 lost once (timeout, resend), first ACK 2 lost (duplicate discarded, re-ACKed).' },
        { id: 't4d', part: 'util', stop: '4d', short: 'Utilisation', title: 'Why stop-and-wait is not enough', click: 'Static.' }
      ],
      syllabus: 'Data Link Layer Protocols, Simplex Protocol',
      problem: 'A dropped frame is silent. How does the sender know to resend?',
      but: 'It works, but a satellite sender sits idle 96% of the time.',
      live: '"Start from a perfect world, Protocol 1, and break it one assumption at a time. A slow receiver needs an ACK before the next frame. A lossy channel needs a timer and a 1-bit sequence number. I kill the ACK: the sender times out and resends, and the receiver discards the duplicate. But on a satellite link the sender sits idle 96% of the time, waiting."',
      click: 'Protocol 3 is selected. Press "Lose ACK", then Run. The duplicate is labelled.',
      facts: [
        'P1 utopian simplex: one-way, error-free, infinite buffers; no flow or error control. (Story: what if nothing ever went wrong?)',
        'P2 simplex stop-and-wait: flow control only; dummy ACK; channel at least half-duplex. (Story: the receiver is slow.)',
        'P3 PAR/ARQ (noisy): timer + retransmit; 1-bit sequence number discards duplicates from lost ACKs; timeout > round trip. (Story: frames get lost.)',
        'Utilisation = frame time / (frame time + RTT): 50 kbps, 500 ms RTT, 1000 bits → 20/520 ≈ 4%.'
      ],
      example: 'Lose an ACK → timeout → resend 0 → "Duplicate of 0 → discard, re-ACK".',
      qa: [
        ['Why is one bit of sequence number enough?', 'Only one frame is ever outstanding, so the only confusion is frame m vs m+1.'],
        ['What if the timer is too short?', 'Premature timeouts send duplicates; the sequence number catches them, but bandwidth is wasted.']
      ]
    },
    {
      id: 't5', topic: 5, stop: '5', act: 1, hero: true, short: 'Sliding window', title: 'Sliding window: Go-Back-N vs Selective Repeat', target: 50,
      subs: [
        { id: 't5', part: 'gbn', stop: '5a', short: 'Go-Back-N', title: 'Go-Back-N (Protocol 5)', click: 'Step runs to the next event. Frame 1 is lost once; GBN resends 1–4. E: what to lose (frame k, ack k). W slider 1–8 (8 = the break: all early ACKs lost, an old frame is taken as new). Tap a frame or ACK in flight to lose it. C: challenge.', predict: { q: 'Frame 1 is lost: how many frames does each protocol resend?', a: 'GBN resends 4 (frames 1–4), SR resends 1' } },
        { id: 't5b', part: 'sr', stop: '5b', short: 'Selective Repeat', title: 'Selective Repeat (Protocol 6)', click: 'Same loss; SR buffers 2–4 and resends only 1. E: what to lose (frame k, ack k). W slider 1–5 (5 = the break). Tap a frame or ACK in flight to lose it.', predict: { q: 'Frame 1 is lost: how many frames does each protocol resend?', a: 'GBN resends 4 (frames 1–4), SR resends 1' } },
        { id: 't5c', part: 'trap', stop: '5c', short: 'SR window limit', title: 'Selective Repeat: why W ≤ 2ⁿ⁻¹', click: 'W = 7, every early ACK lost: old frame 0 is accepted as new.' }
      ],
      syllabus: 'Sliding Window Protocols',
      problem: 'One frame per round trip wastes the pipe.',
      but: "That's two machines on one wire. A LAN is fifty machines on one cable. Who talks?",
      live: '"Fix: keep a window of frames in flight, so the pipe stays full while ACKs come back. Then one lost frame forces a choice. Go-Back-N throws away everything after the hole and resends it all. Selective Repeat buffers and resends just the one, at the cost of buffers at the receiver. Now the trap: with 3-bit numbers, why is SR\'s window capped at 4 and not 7? Watch what happens at 7. … Old frame 0 is accepted as new. So one link between two machines is now reliable and efficient. But a LAN isn\'t two machines on a wire. It\'s fifty machines on one cable. Who gets to talk?"',
      click: 'Run (or S) on the default. Then "Trap: SR W=7", Run → red banner. Then "Replay with W=4".',
      facts: [
        'Sequence numbers 0…2ⁿ−1. Piggybacking; ACK timer forces a standalone ACK.',
        'BD = bandwidth × one-way delay (frames); w = 2BD + 1. 50 kbps × 250 ms, 1000-bit frames → BD 12.5 → w 26. Utilisation ≤ w/(1+2BD).',
        'GBN (P5): receiver window 1, cumulative ACKs, resend ALL outstanding on timeout. Max window 2ⁿ−1.',
        'SR (P6): receiver buffers in-window frames, NAKs the hole, sender resends only that one. Max window 2ⁿ⁻¹.',
        'Trap (Fig 3-21): 3 bits, W=7, all ACKs lost → old frame 0 accepted as new. W=4: windows do not overlap.',
        'ACK number: Tanenbaum = last received correctly; Forouzan = next expected.'
      ],
      example: 'n=3, W=4, first copy of 1 lost: GBN discards 2, 3 (and 4) and resends them all; SR buffers and resends only 1.',
      qa: [
        ['Why is GBN max 2ⁿ−1 but SR only 2ⁿ⁻¹?', "SR's new receiver window must not overlap the old one, or an old frame looks new (trap demo). GBN's receiver window is 1, so only window = 2ⁿ is ambiguous."],
        ['When is GBN preferable?', 'Low error rates; simpler receiver with no buffering.'],
        ['Why does the app\'s SR ACK each frame?', 'Selective ACKs (as in Forouzan). Tanenbaum\'s Protocol 6 piggybacks a cumulative ACK; with this short 8-tick timer, 2 and 3 would also time out before that ACK returns.']
      ]
    },

    /* ---------- Act 2 · Shared channel ---------- */
    {
      id: 't6', topic: 6, stop: '6', act: 2, short: 'ALOHA', title: 'Channel allocation & ALOHA', target: 25,
      subs: [
        { id: 't6', part: 'static', stop: '6a', short: 'Static allocation', title: 'Static channel allocation', click: 'Static.' },
        { id: 't6b', part: 'curves', stop: '6b', short: 'ALOHA throughput', title: 'ALOHA: throughput vs load', click: 'Static.' },
        { id: 't6c', part: 'pure', stop: '6c', short: 'Pure ALOHA', title: 'Pure ALOHA: vulnerable period', click: 'Static, G = 1.' },
        { id: 't6d', part: 'slotted', stop: '6d', short: 'Slotted ALOHA', title: 'Slotted ALOHA: vulnerable period', click: 'Static, G = 1.' }
      ],
      syllabus: 'Medium Access Control Sublayer, Channel Allocation Problem, Multiple Access Protocols, ALOHA',
      problem: 'Many stations, one channel. Fixed slices waste bursty traffic. Who sends?',
      but: "ALOHA doesn't even check whether someone is already talking.",
      history: 'ALOHAnet, Norman Abramson, University of Hawaii, 1971: radio links between the islands.',
      live: '"Give every station a fixed slice and most slices sit empty, because traffic is bursty. In 1971 the University of Hawaii tried the opposite: just transmit, and resend if it collides. At best that uses 18% of the channel. Adding time slots halves the vulnerable period and doubles the best case to 37%. But ALOHA never even checks whether someone is already talking."',
      click: 'Drag the G marker on the plot. Toggle Pure/Slotted on the timeline.',
      facts: [
        'Static FDM/TDM wastes capacity on bursty traffic: T = 1/(μC − λ); N sub-channels → T_N = N·T. C = 100 Mbps, 1/μ = 10,000 bits, λ = 5000/s → T = 200 µs.',
        'Dynamic assumptions: independent traffic, single channel, observable collisions, continuous or slotted time, carrier sense or not.',
        'Pure ALOHA: vulnerable 2 frame times; S = G·e^(−2G); max 1/2e ≈ 18.4% at G = 0.5.',
        'Slotted ALOHA: vulnerable 1 frame time; S = G·e^(−G); max 1/e ≈ 36.8% at G = 1 (36.8% empty, 36.8% success, 26.4% collide).'
      ],
      example: 'G = 1 → pure 0.135, slotted 0.368.',
      qa: [['Why is pure ALOHA\'s vulnerable period 2t?', 'Any frame starting up to t before or t after yours overlaps it.']]
    },
    {
      id: 't7a', screen: 't7', topic: 7, stop: '7a', act: 2, hero: true, short: 'CSMA & CSMA/CD', title: 'CSMA & CSMA/CD', target: 40,
      subs: [
        { id: 't7a', part: '1p', stop: '7a', short: '1-persistent CSMA', title: '1-persistent CSMA', click: 'Step runs to the next event. Drag B along the cable; [ ] nudge it. C: challenge (make A and B collide).' },
        { id: 't7b', part: 'np', stop: '7b', short: 'Non-persistent CSMA', title: 'Non-persistent CSMA', click: 'Step runs to the next event. Drag B along the cable; [ ] nudge it.' },
        { id: 't7c', part: 'pp', stop: '7c', short: 'p-persistent CSMA', title: 'p-persistent CSMA', click: 'Step runs to the next event. Drag B along the cable; [ ] nudge it.' },
        { id: 't7d', part: 'cd', stop: '7d', short: 'CSMA/CD', title: 'CSMA with collision detection', click: 'Step runs to the next event: collision, jam, backoff. Drag D (the far station) along the cable; [ ] nudge it.' },
        { id: 't7e', part: 'minframe', stop: '7e', short: 'Minimum frame', title: 'CSMA/CD: minimum frame size', click: 'Static.' }
      ],
      syllabus: 'CSMA Protocols',
      problem: 'Listen before talking, and stop when you collide.',
      but: "Put together, that's exactly classic Ethernet.",
      live: '"So listen first, and collisions still happen, because signals take time to travel. D can\'t hear A yet, so it starts too. With collision detection both stop, jam, and roll dice, and the dice range doubles after every collision. If the frame is too short, A finishes before the collision news comes back. That\'s exactly why Ethernet frames are at least 64 bytes. But put those pieces together and you\'ve built classic Ethernet."',
      click: '"Far ends start together" → Run. Then "Short frame" → Run. Backoff draws appear in the log.',
      facts: [
        '1-persistent: busy → wait for idle, send at once; waiters collide. Non-persistent: busy → random wait, sense again. p-persistent (slotted): idle → send with p, defer a slot with q; if someone starts meanwhile act as if collided; busy at start → wait next slot.',
        'Carrier sense still collides because of propagation delay τ.',
        'CSMA/CD: abort on detection, short jam; contention / transmission / idle periods; contention slot = 2τ.',
        'Classic Ethernet: 10 Mbps, 2500 m, 4 repeaters → RTT ≈ 50 µs; slot 51.2 µs = 512 bit times → 64-byte minimum frame.',
        'BEB: after collision i, K uniform in 0…2ⁱ−1 slots; frozen at 0…1023 after 10; give up after 16.'
      ],
      example: '10 Mbps × 51.2 µs = 512 bits = 64 bytes. Collision #3 → K ∈ {0..7}.',
      qa: [
        ['Why a 64-byte minimum?', 'The frame must last ≥ 2τ so the sender is still transmitting when collision news returns: 10 Mbps × 51.2 µs = 512 bits.'],
        ['Why exponential backoff?', 'It adapts to the number of contenders: short waits when few, spread out when many. The 1023 cap bounds the delay.'],
        ['Is CD used today?', 'Switched full-duplex Ethernet has no collisions; CD matters only for half-duplex/hubs.']
      ]
    },
    {
      id: 't7f', screen: 't9', part: 'eth', topic: 7, stop: '7f', act: 2, short: 'Ethernet MAC', title: 'Ethernet MAC sublayer', target: 15,
      syllabus: 'Ethernet MAC Sublayer Protocol',
      problem: 'What does a real frame carrying all these fixes look like?',
      but: 'Ethernet accepts collisions and cleans up after them. Can we avoid them entirely?',
      history: 'Ethernet, Bob Metcalfe, Xerox PARC, 1973.',
      live: '"Metcalfe\'s Ethernet, 1973, is everything we\'ve built so far in one frame: a preamble for framing, CRC-32 in the trailer, padding up to 64 bytes for collision detection. But Ethernet accepts collisions and cleans up after them. Could we avoid them altogether?"',
      click: 'Click a frame field. Type a data length (10 → pad 36). Point at the three back-link tags under the bar.',
      facts: [
        'Ethernet: Preamble 8 (7×10101010 + SOF 10101011) · Dest 6 · Src 6 · Type/Length 2 · Data 0–1500 · Pad 0–46 · Checksum 4 (CRC-32). Min 64, max 1518 (dest → checksum).',
        'Type/length: ≤ 1500 (0x05DC) length; ≥ 1536 (0x0600) type (0x0800 IPv4, 0x0806 ARP, 0x86DD IPv6).',
        'Addresses 48 bits; I/G bit (first on the wire) 1 = multicast; all 1s broadcast; first 3 bytes OUI.',
        'Ethernet MAC = 1-persistent CSMA/CD + BEB (S7a).'
      ],
      example: 'Data 10 bytes → pad 36 → 64-byte frame.',
      qa: []
    },
    {
      id: 't8', part: 'turns', topic: 8, stop: '8', act: 2, short: 'Collision-free', title: 'Collision-free protocols', target: 20,
      subs: [
        { id: 't8', part: 'bitmap', stop: '8a', short: 'Bitmap', title: 'Collision-free: the bitmap protocol', click: 'Static.' },
        { id: 't8b', part: 'token', stop: '8b', short: 'Token passing', title: 'Collision-free: token passing', click: 'Static.' },
        { id: 't8c', part: 'countdown', stop: '8c', short: 'Binary countdown', title: 'Collision-free: binary countdown', click: 'Step reveals one bit time. ← undoes.' }
      ],
      syllabus: 'Collision-Free Protocols',
      problem: 'Every collision wastes contention time. Can stations take turns instead?',
      but: 'All of these assume every station hears every other station. Radio breaks that.',
      live: '"Instead of colliding and recovering, take turns: reserve a slot in a bitmap, pass a token, or let the highest address win bit by bit. Here 1010 wins in four bit times. But every one of these assumes all stations can hear each other. Radio breaks that."',
      click: 'S steps binary countdown (4 presses). Addresses are editable.',
      facts: [
        'Bitmap: N reservation slots; efficiency d/(d+N) low load, d/(d+1) high load.',
        'Token passing: only the holder sends (token ring 802.5, token bus).',
        'Binary countdown: addresses MSB first, channel ORs; sent 0 & saw 1 → drop out; highest address wins; efficiency d/(d+log₂N). 0010, 0100, 1001, 1010 → 1010.'
      ],
      example: 'Binary countdown 0010, 0100, 1001, 1010 → 1010 wins.',
      qa: [['Is binary countdown fair?', 'No, high addresses always win. Fix: rotate virtual station numbers.']]
    },
    {
      id: 't9a', screen: 't8', part: 'wireless', topic: 9, stop: '9a', act: 2, short: 'Wireless LAN', title: 'Wireless LAN protocols', target: 20,
      subs: [
        { id: 't9a', part: 'hidden', stop: '9a', short: 'Hidden terminal', title: 'Wireless LAN: the hidden terminal', click: 'Step adds MACA (RTS/CTS).' },
        { id: 't9b', part: 'exposed', stop: '9b', short: 'Exposed terminal', title: 'Wireless LAN: the exposed terminal', click: 'Step adds MACA (RTS/CTS).' }
      ],
      syllabus: 'Wireless LAN Protocols',
      problem: "On radio you can't hear everyone, and you can't listen while you send.",
      but: '802.11 turns this idea into a full MAC.',
      history: 'MACA, Phil Karn, 1990.',
      live: '"On radio, listening first fails both ways. A and C can\'t hear each other, so both talk and collide at B: the hidden terminal. C hears B and stays quiet for no reason: the exposed terminal. MACA\'s fix is to make the receiver announce it\'s busy, with RTS and CTS. But that\'s only the idea. 802.11 builds a full MAC on it."',
      click: 'S cycles: hidden → hidden + MACA → exposed → exposed + MACA. Or use the buttons.',
      facts: [
        'Wireless: collisions that matter happen at the receiver; radios cannot detect collisions while sending.',
        'Hidden: A, C reach B not each other → collide at B. Exposed: B→A; C hears B and wrongly holds off sending to D.',
        'MACA: RTS (length) → CTS (length). Hear CTS → stay silent (fixes hidden). Hear only RTS → may send (fixes exposed). RTS collision → no CTS → back off.'
      ],
      example: 'Hidden: A→B and C→B collide at B. With MACA, C hears B\'s CTS and stays silent.',
      qa: [['Why can\'t 802.11 use CD?', 'Radios can\'t hear while sending, and collisions happen at the receiver (hidden terminals). So 802.11 uses CSMA/CA + ACKs.']]
    },
    {
      id: 't9c', screen: 't9', part: 'wifi', topic: 9, stop: '9c', act: 2, short: '802.11 MAC', title: '802.11 MAC sublayer', target: 15,
      syllabus: '802.11 MAC Sublayer Protocol',
      problem: "Wi-Fi can't detect collisions, so it must avoid them and confirm every frame.",
      but: 'Wired or wireless, one LAN only reaches so far and holds so many stations.',
      live: '"So Wi-Fi avoids collisions instead: wait DIFS, back off, send, and demand an ACK for every frame. The shortest gap, SIFS, is reserved for that ACK so nobody can cut in. But wired or wireless, one LAN only reaches so far and holds so many stations."',
      click: 'S toggles RTS/CTS (adds the NAV bars).',
      facts: [
        '802.11 CSMA/CA: idle DIFS → random backoff (frozen while busy) → send; ACK after SIFS; no ACK → double backoff.',
        'Carrier sensing: physical + virtual via the NAV (set from the Duration field); RTS/CTS optional.',
        'IFS, shortest first: SIFS < (AIFS1) < DIFS < (AIFS4) < EIFS.',
        '802.11 frame: FC · Duration · Addr1 (receiver) · Addr2 (transmitter) · Addr3 (other end beyond the AP) · Seq · Data ≤ 2312 · FCS 4.'
      ],
      example: 'DIFS → backoff 3, 2, 1 → DATA → SIFS → ACK.',
      qa: [
        ['Why three addresses in 802.11?', 'Receiver (the AP), transmitter, and the final destination or source beyond the AP.'],
        ['Why is SIFS shorter than DIFS?', 'So the ACK or CTS of an exchange in progress always beats anyone new contending.']
      ]
    },

    /* ---------- Act 3 · Many LANs ---------- */
    {
      id: 't10', topic: 10, stop: '10', act: 3, short: 'Switching & devices', title: 'Data link layer switching & devices', target: 25,
      subs: [
        { id: 't10', part: 'learning', stop: '10a', short: 'Learning bridge', title: 'Learning bridges', click: 'Step sends the next scripted frame: A→D floods, D→A forwards, B→A is filtered (A is on B\'s own port).' },
        { id: 't10b', part: 'devices', stop: '10b', short: 'Devices', title: 'Repeaters, hubs, bridges, switches, routers, gateways', click: 'Static.' }
      ],
      syllabus: 'Uses of Bridges, Learning Bridges, Repeaters, Hubs, Bridges, Switches, Routers and Gateways',
      problem: 'Join LANs without one giant collision domain.',
      but: 'A switch only knows MAC addresses on its own LAN. To reach a server abroad, the frame must reach a router and become a packet.',
      history: 'Spanning tree, Radia Perlman, DEC, 1985.',
      live: '"To join LANs, put a bridge between them; a switch is a many-port learning bridge. It starts knowing nothing, floods, and learns from source addresses. Three frames in, its table is built. Hubs repeat bits, switches learn MAC addresses. But a switch only knows the addresses on its own LAN. To reach a server in another country, the frame has to reach a router and become a packet."',
      click: 'S plays A→D (flood), D→A (forward), B→A (filter).',
      facts: [
        'Uses: join LANs, extend distance, isolate traffic (each LAN its own collision domain), reliability.',
        'Learning bridge: learns source MAC → arrival port (timestamped). Dest on arrival port → discard; known elsewhere → forward; unknown → flood all but arrival port. Entries age out; promiscuous; plug-and-play.',
        'Spanning tree (Perlman, 802.1D): loops → broadcast storms; elect lowest-ID root, shortest-path tree, disable other ports.',
        'Physical: repeater, hub (one collision domain). Data link: bridge, switch (one per port; full duplex = no collisions). Network: router (separates broadcast domains). Transport/application: gateways.'
      ],
      example: 'A→D floods · D→A forwards · B→A filtered. 8-port hub/switch/router: collision 1/8/8, broadcast 1/1/8.',
      qa: [
        ['Why learn from the source, not the destination?', 'The source tells you where the sender lives; the destination says nothing about location.'],
        ['Domains for 8-port hub / switch / router?', 'Collision: 1 / 8 / 8. Broadcast: 1 / 1 / 8.'],
        ['What if bridges form a loop?', 'Flooded frames circulate forever (a broadcast storm). The spanning tree disables the redundant ports.']
      ]
    },
    {
      id: 'bridge', title: 'Unit III: the packet', target: 10,
      syllabus: 'Unit III: Network Layer',
      live: '"The frame has reached the router. Now it\'s a packet, and the router has to decide where it goes next."',
      click: '→'
    },

    /* ---------- Act 4 · Finding a path ---------- */
    {
      id: 't11a', screen: 't11', part: 'flood', topic: 11, stop: '11a', act: 4, short: 'Design issues + flooding', title: 'Design issues & flooding', target: 20,
      subs: [
        { id: 't11a', part: 'vc', stop: '11a', short: 'Datagram vs VC', title: 'Datagram vs virtual-circuit networks', click: 'Static.' },
        { id: 't11b', part: 'flood', stop: '11b', short: 'Flooding', title: 'Flooding', click: 'Step sends the next hop; hop counter 3. ← undoes.' }
      ],
      syllabus: 'Design Issues – Routing Algorithms, Flooding',
      problem: 'The router has a packet. Which line does it go out on?',
      but: 'Flooding finds the shortest path but drowns the network in copies. With a map, a router could compute the best path once.',
      live: '"A router does two jobs: forwarding, an instant lookup per packet, and routing, which fills the table. With zero knowledge, the simplest routing is to send a copy everywhere. That\'s flooding. It always finds the shortest path, and look at the duplicate count. But if a router had a map, it could work out the best path once."',
      click: 'S floods one hop at a time (hop counter 3). Toggle sequence numbers to damp the duplicates.',
      facts: [
        'Store-and-forward: hold the packet until it has fully arrived and its checksum is verified.',
        'Services to transport: independent of router technology, topology hidden, uniform addresses.',
        'Datagram (IP) vs VC (MPLS): setup none/required · full address/short VC number · router state none/per connection · routing per packet/fixed at setup · failure loses packets in flight/kills VCs through it · QoS hard/easy.',
        'Routing fills tables; forwarding looks up each packet. Properties: correctness, simplicity, robustness, stability, fairness, efficiency. Non-adaptive vs adaptive.',
        'Flooding: out on every line except arrival; damp with hop counter or per-source sequence numbers; robust, finds shortest path, used for broadcast.'
      ],
      example: 'Flood from A, hop counter 3: copies grow every hop; with sequence numbers each router forwards only the first copy.',
      qa: [
        ['Why isn\'t flooding used for everything?', 'Duplicates grow exponentially. Kept for broadcast, robustness and as a benchmark.'],
        ['Datagrams or VCs on the Internet?', 'Datagrams (IP). MPLS adds VC-like labels inside ISP networks.']
      ]
    },
    {
      id: 't11c', screen: 't11', part: 'dijkstra', topic: 11, stop: '11c', act: 4, short: 'Optimality + Dijkstra', title: 'Optimality principle & Dijkstra', target: 25,
      subs: [
        { id: 't11c', part: 'optimality', stop: '11c', short: 'Optimality principle', title: 'The optimality principle', click: 'Static.' },
        { id: 't11d', part: 'dijkstra', stop: '11d', short: 'Dijkstra', title: 'Dijkstra\'s shortest path algorithm', click: 'Step makes the next label permanent. ← undoes. Ends with A → D = 10 via A-B-E-F-H-D.' }
      ],
      syllabus: 'The Optimality Principle, Shortest Path Algorithm',
      problem: 'Given a map, what is the best path, and is there a consistent answer?',
      but: 'Dijkstra needs the whole map. Who gives every router the map and keeps it current?',
      history: "Dijkstra's algorithm, 1959.",
      live: '"The optimality principle says that if B is on my best path to D, then B\'s best path to D is the rest of mine. So the best routes to a destination form a tree. Dijkstra builds that tree: make the smallest label permanent, relax its neighbours, repeat. A to D is 10. But Dijkstra needs the whole map. Who gives every router the map, and keeps it current when links fail?"',
      click: 'S makes the next node permanent (8 presses, or Finish). Click a node for the destination; click an edge to change its weight (shift-click lowers).',
      facts: [
        'Optimality principle: J on optimal I→K path ⇒ optimal J→K follows the same route; optimal routes to a destination form a sink tree (no loops).',
        'Dijkstra: (dist, pred) labels, tentative/permanent; make smallest permanent, relax neighbours; weights ≥ 0.'
      ],
      example: 'A→D = 10 via A-B-E-F-H-D; permanent order A, B, E, G, F, H, C, D.',
      qa: [['Why is greedy Dijkstra correct?', 'With non-negative weights, no path through other tentative nodes can beat the smallest label.']]
    },
    {
      id: 't12', topic: 12, stop: '12', act: 4, hero: true, short: 'Distance vector', title: 'Distance vector routing', target: 45,
      subs: [
        { id: 't12', part: 'good', stop: '12a', short: 'DV: good news', title: 'Distance vector: good news travels fast', click: 'Step = one exchange. Routers: chain length 3–6. Click a router in the top row to take it down/up.' },
        { id: 't12b', part: 'bad', stop: '12b', short: 'DV: bad news', title: 'Distance vector: count to infinity', click: 'Step = one exchange; distances climb toward ∞ = 16. Routers: chain length 3–6.', predict: { q: 'A dies: how many exchanges until every router reads 16?', a: '15 exchanges (with poisoned reverse: 4)' } },
        { id: 't12c', part: 'poison', stop: '12c', short: 'Poisoned reverse', title: 'Split horizon with poisoned reverse', click: 'Bad news now spreads one hop per exchange: every router reads 16 after 4 exchanges (on this chain). Routers: chain length 3–6.', predict: { q: 'With poisoned reverse: exchanges until every router reads 16?', a: '4 exchanges (without it: 15)' } }
      ],
      syllabus: 'Distance Vector Routing',
      problem: 'No router has the map. Can routers find best paths by only asking their neighbours?',
      but: 'Bad news crawls. In 1979 the ARPANET replaced it.',
      history: 'The ARPANET used distance vector until 1979, then switched to link state.',
      live: '"Nobody has the map, so each router tells only its neighbours how far it thinks everything is. Good news, A coming up, spreads one hop per exchange. Now the bad news: A dies. B hears from C that A is 2 away, not realising that path runs through B itself. So B says 3, C says 4… they\'re counting to infinity. RIP stops this at 16. But bad news crawls, and in 1979 the ARPANET replaced distance vector."',
      click: '"Good news" then S × 4. "Bad news" then S repeatedly (or Run). Toggle split horizon to show the fix.',
      facts: [
        'Each router keeps (distance, line) per destination; exchanges only with neighbours. Distributed Bellman-Ford; ARPANET, RIP.',
        'D(x,y) = min over neighbours v of [c(x,v) + D_v(y)].',
        'Good news: k hops away after k exchanges: ∞∞∞∞ → 1∞∞∞ → 12∞∞ → 123∞ → 1234.',
        'Bad news counts to infinity: 1234 → 3234 → 3434 → 5454 → 5656 → 7676 → … Infinity = longest path + 1 (RIP 16).',
        'Root cause: B cannot know C\'s path to A goes through B.',
        'Split horizon + poisoned reverse (Q&A only): 1234 → 16 2 3 4 → 16 16 3 4 → 16 16 16 4 → all 16. Still fails on loops of 3+. Path vector (BGP) fixes it.'
      ],
      example: 'Chain A–E, A goes down: 1 2 3 4 → 3 2 3 4 → 3 4 3 4 → 5 4 5 4 → 5 6 5 6 → 7 6 7 6.',
      qa: [
        ['How does RIP limit it?', 'Infinity = 16 (max diameter 15), split horizon / poisoned reverse, triggered updates.'],
        ['DV or LS?', 'LS converges faster with no count-to-infinity, but needs more memory and computation. DV is simpler.']
      ]
    },
    {
      id: 't13', topic: 13, stop: '13', act: 4, short: 'Link state', title: 'Link state routing', target: 20,
      subs: [
        { id: 't13', part: 'steps', stop: '13a', short: 'Link state steps', title: 'Link state routing: five steps', click: 'Step walks the five steps for router B (flood hop by hop), then Dijkstra one permanent label per Step. ← undoes.' },
        { id: 't13b', part: 'compare', stop: '13b', short: 'DV vs LS', title: 'Distance vector vs link state', click: 'Static.' }
      ],
      syllabus: 'Link State Routing',
      problem: 'Give every router the full map instead of rumours.',
      but: 'Every router now picks the best route. But if everyone sends at once, the best route jams.',
      history: 'The ARPANET used distance vector until 1979, then switched to link state.',
      live: '"Distance vector is routing by rumour. Link state is routing with a map, built from two things we\'ve already seen: every router floods a postcard describing only its own links, then runs Dijkstra on the full map. Sequence numbers and age stop stale postcards. That\'s OSPF. But now every router picks the same best route, and if everyone sends at once, that route jams."',
      click: 'S walks the 5 steps. Step 4 is S11a\'s flooding, step 5 is S11b\'s Dijkstra. At step 5, click any router to see its table.',
      facts: [
        '1 Discover neighbours (HELLO); a broadcast LAN is modelled as a node.',
        '2 Link costs: inverse of bandwidth (1 Gbps → 1, 100 Mbps → 10) or delay via ECHO.',
        '3 Build LSP: sender ID, sequence number, age, neighbours with costs.',
        '4 Flood LSPs (= S11a flooding): keep (source, seq), drop old/duplicates; 32-bit seq; age decremented every second and per hop; buffer with send/ACK flags per line.',
        '5 Each router runs Dijkstra (= S11b) on the full map. OSPF, IS-IS. Memory ≈ k·n.'
      ],
      example: 'LS = S11a\'s flooding + S11b\'s Dijkstra. Each router floods one LSP; every router gets the same map.',
      qa: [['Why does LS converge faster?', 'One flood, then local computation. No counting to infinity (brief loops possible while the flood is in progress).']]
    },

    /* ---------- Act 5 · Too much traffic ---------- */
    {
      id: 't14', topic: 14, stop: '14', act: 5, short: 'Congestion control', title: 'Congestion control', target: 25,
      subs: [
        { id: 't14', part: 'approaches', stop: '14a', short: 'Approaches', title: 'Approaches to congestion control', click: 'Static.' },
        { id: 't14b', part: 'routing', stop: '14b', short: 'Traffic-aware routing', title: 'Traffic-aware routing', click: 'Static.' },
        { id: 't14c', part: 'throttling', stop: '14c', short: 'Throttling', title: 'Admission control & traffic throttling', click: 'Static.' },
        { id: 't14d', part: 'shedding', stop: '14d', short: 'Load shedding', title: 'Load shedding', click: 'Step: normal → tail drop (wine) → head drop (milk) → RED. Picture of the trend only.' }
      ],
      syllabus: 'Congestion Control Approaches, Traffic-Aware Routing, Admission Control, Traffic Throttling, Load Shedding',
      problem: "Good routes don't help when more traffic arrives than the links can carry.",
      but: 'All this assumes one network run one way. The Internet is thousands of networks that differ in everything.',
      history: 'RED, Floyd & Jacobson, 1993.',
      live: '"Congestion is a traffic jam, and the fixes run from slow to fast: build more roads, route around the jam, which can make traffic oscillate, stop new cars entering, tell drivers to slow down, and as a last resort tow cars away. When you tow, which go first: wine, where old is better, or milk, where new is better? But all of this assumes one network run one way. The Internet is thousands of networks that differ in everything."',
      click: 'Drag load to 130%. Turn on admission, then throttling, then RED. Wine/milk toggle.',
      facts: [
        'Congestion: too many packets in (part of) the network; delay climbs, loss, goodput collapses. More buffers don\'t help (timeouts → duplicates).',
        'Congestion control (whole network) vs flow control (one sender–receiver, S4–S5).',
        'Slow/preventive → fast/reactive: provisioning → traffic-aware routing → admission control → traffic throttling → load shedding.',
        'Traffic-aware routing: load in link weights; risk oscillation (East/West); fix multipath, shift slowly; Internet uses traffic engineering.',
        'Admission control: refuse a VC that would congest; token bucket (rate + burst); route new VCs around hot spots.',
        'Throttling: EWMA d_new = α·d_old + (1−α)·s; choke packets (tag original), ECN (2 IP bits, receiver echoes), hop-by-hop backpressure.',
        'Load shedding: wine (old better, file transfer) drops new; milk (new better, real-time) drops old; priority; RED drops randomly once AVERAGE queue passes a threshold (implicit signal to TCP).'
      ],
      example: 'Overload with tail drop → goodput falls; admission + throttling + RED keep it near capacity.',
      qa: [
        ['ECN vs choke packets?', 'ECN marks the packet itself (no extra traffic) and reaches the sender via the receiver. A choke packet goes straight to the source.'],
        ['Congestion control vs flow control?', 'Flow control protects one receiver from one sender (S4–S5). Congestion control protects the network from everyone.']
      ]
    },

    /* ---------- Act 6 · Many networks ---------- */
    {
      id: 't15a', screen: 't15a', part: 'differ', topic: 15, stop: '15a', act: 6, short: 'Internetworking', title: 'Internetworking', target: 15,
      subs: [
        { id: 't15a', part: 'differ', stop: '15a', short: 'How networks differ', title: 'How networks differ', click: 'Static.' },
        { id: 't15b', part: 'frag', stop: '15b', short: 'Fragmentation', title: 'Fragmentation', click: 'Static: 4000-byte datagram, MTU 1500.' }
      ],
      syllabus: 'Internetworking',
      problem: 'Networks differ in addressing, service and maximum packet size. How does one packet cross them all?',
      but: "IP's answer needs one common header and one global address plan.",
      live: '"Every network we\'ve seen has different addressing, a different service and a different maximum packet size. The Internet\'s answer is one common layer, IP, on top of all of them. When a packet is too big for the next network, it\'s split into fragments and reassembled at the destination. But that only works with one common header and one global address plan."',
      click: 'Nothing to click: point at the three fragments (offset in 8-byte units, MF on all but the last).',
      facts: [
        'Networks differ: service model, addressing, broadcast/multicast, max packet size, ordering, QoS, reliability, security, parameters, accounting. IP is the common layer.',
        'Fragmentation: transparent (reassembled at the exit router) vs non-transparent (at the destination: IP). Identification, DF, MF, offset in 8-byte units. Path MTU discovery: DF + ICMP "too big".'
      ],
      example: '4000-byte datagram (20 + 3980), MTU 1500 → lengths 1500 / 1500 / 1040, offsets 0 / 185 / 370, MF 1 / 1 / 0.',
      qa: [['Why is the offset in 8-byte units?', 'The field is 13 bits; 2¹³ × 8 = 65,536 covers the largest datagram. So every fragment but the last carries a multiple of 8 data bytes.']]
    },
    {
      id: 't15b', screen: 't15b', part: 'v4', topic: 15, stop: '15b', act: 6, hero: true, short: 'IPv4 + IP Lab', title: 'IP Lab: IPv4 & IP addresses', target: 35,
      subs: [
        { id: 't15c', part: 'addr', stop: '15c', short: 'IPv4 address', title: 'IPv4 addresses and masks', click: 'Prefix slider /0–/32 (spelled out at /31 and /32). Default 192.168.10.77/26. C: challenge (exactly 30 hosts). E: any a.b.c.d/p.' },
        { id: 't15d', part: 'subnet', stop: '15d', short: 'Subnetting', title: 'Subnetting', click: 'Subnets chips: 2, 4 or 8 equal subnets of 192.168.10.64/26.' },
        { id: 't15e', part: 'lpm', stop: '15e', short: 'Longest prefix match', title: 'CIDR: longest prefix match', click: 'Tap a destination: the matching row of Tanenbaum\'s Cambridge/Edinburgh/Oxford table lights; 194.24.12.9 matches none (default route).' }
      ],
      syllabus: 'IPv4, IP Addresses',
      problem: 'Every host on every network needs a unique address that routers can aggregate.',
      but: 'Even with CIDR and NAT, 32 bits ran out.',
      history: 'CIDR, 1993.',
      live: '"An IPv4 address is a network prefix plus a host part. Fixed-size classes wasted huge blocks, so since 1993 prefixes can be any length: that\'s CIDR. Professor, give me any IP and prefix. … The mask splits network bits from host bits, AND gives the network address, all-ones gives the broadcast, and two fewer than 2^(host bits) are usable. Routers pick the longest matching prefix. But even with CIDR and NAT, 32 bits ran out."',
      click: 'Type any a.b.c.d/n (or address + mask). Tab 2: Longest prefix match (Tanenbaum preset).',
      facts: [
        'IPv4 header 20 bytes min: Version · IHL (5–15 words) · DS (6 DSCP + 2 ECN) · Total length ≤ 65,535 · Identification · DF · MF · Offset (13 bits) · TTL · Protocol (1 ICMP, 6 TCP, 17 UDP) · Source · Destination · Options. Checksum covers header only; recomputed every hop (TTL changes).',
        'Usable hosts = 2^(32−n) − 2; /31 point-to-point (RFC 3021); /32 one host. 0.0.0.0 this host; 255.255.255.255 local broadcast; 127/8 loopback. Private + NAT: 10/8, 172.16/12, 192.168/16.',
        'Classes: A 0 (/8), B 10 (/16), C 110 (/24), D 1110 multicast, E 1111 reserved. Fixed class sizes wasted addresses → CIDR.',
        'Subnetting splits internally; CIDR aggregates; longest matching prefix wins. 194.24.17.4 → Oxford /20.'
      ],
      example: '192.168.10.77/26 → mask 255.255.255.192, network .64, broadcast .127, 62 usable.',
      qa: [
        ['What does CIDR solve?', 'Wasted class-sized blocks and routing-table explosion, via aggregation.'],
        ['Why longest prefix match?', 'The most specific route wins, so you can aggregate and still have exceptions.']
      ]
    },
    {
      id: 't15c', screen: 't15a', part: 'tunnel', topic: 15, stop: '15c', act: 6, short: 'IPv6 → tunneling → AS', title: 'IPv6 → tunneling → AS routing', target: 20,
      subs: [
        { id: 't15f', part: 'v6addr', stop: '15f', short: 'IPv6 address', title: 'IPv6 addresses', click: 'Static.' },
        { id: 't15g', part: 'headers', stop: '15g', short: 'IPv4 vs IPv6 header', title: 'IPv4 vs IPv6 header', click: 'Static.' },
        { id: 't15h', part: 'tunnel', stop: '15h', short: 'Tunneling', title: 'Tunneling IPv6 across IPv4', click: 'Step moves the packet through the five stops. ← undoes.' },
        { id: 't15i', part: 'as', stop: '15i', short: 'Two-level routing', title: 'Internetwork routing: two levels', click: 'Static.' }
      ],
      syllabus: 'IPv6, Tunneling, Internetwork Routing',
      problem: "4.3 billion addresses aren't enough.",
      but: "'Hi' reaches the server's IP. But IP loses, duplicates and reorders packets, and the server runs a hundred programs. Which one gets 'Hi'?",
      history: 'IANA allocated its last free IPv4 blocks in February 2011.',
      live: '"So IPv6 has 128-bit addresses and a fixed 40-byte header, with no checksum because the link already has CRC. But you can\'t upgrade the whole Internet overnight, so IPv6 islands tunnel across IPv4, like a car on a train through the Channel. And the path crosses networks run by different organisations: OSPF inside each one, BGP between them. So \'Hi\' reaches the server\'s IP. But IP loses, duplicates and reorders packets, and the server runs a hundred programs. Which one gets \'Hi\'?"',
      click: 'S: panel 1 IPv6 → panel 2 tunnel (plays itself; its Step button replays) → panel 3 two-level routing.',
      facts: [
        'IPv6: 128 bits; drop leading zeros, one :: per address. 2001:0db8:0000:0000:0000:ff00:0042:8329 → 2001:db8::ff00:42:8329.',
        'Fixed 40-byte header: Version, DS, Flow label (20), Payload length, Next header, Hop limit, Src, Dst. Removed: IHL, checksum, router fragmentation (source only; min MTU 1280). Extension headers: hop-by-hop, dest options, routing, fragmentation, authentication, ESP.',
        'Tunneling (can\'t upgrade overnight): same-type source and destination, different network between. IPv6 in IPv4 (protocol 41) between multiprotocol routers (car on the Channel train). Hosts on the middle network unreachable. VPN = tunnel + encryption.',
        'Two-level routing (path crosses many owners): intradomain in an AS (OSPF, S13), interdomain between ASes (BGP, policy).'
      ],
      example: '8000:0000:0000:0000:0123:4567:89AB:CDEF → 8000::123:4567:89AB:CDEF. IPv6 + IPv4 header (protocol 41) across the IPv4 network.',
      qa: [
        ['Why did IPv6 drop the checksum?', 'Speed. Link (CRC) and transport layers already check, and IPv4 had to recompute it every hop.'],
        ['Tunneling vs dual stack?', 'Dual stack runs both protocols on a host. Tunneling carries one protocol across a network that only speaks the other.']
      ]
    },
    {
      id: 'podium', kind: 'podium', title: 'Leaderboard', target: 20,
      syllabus: 'Live quiz: Units II + III',
      live: '"And the people who were listening best…" Read out 3rd, 2nd, 1st. Skipped automatically when the quiz is off or nobody scored. Units IV–V have no quiz.',
      click: '→ to S16.'
    },

    /* ---------- Act 7 · End to end (Unit IV) ---------- */
    {
      id: 't16', topic: 16, stop: '16', act: 7, short: 'UDP vs TCP', title: 'Transport: ports, UDP and the TCP header', target: 0,
      subs: [
        { id: 't16', part: 'ports', stop: '16a', short: 'Ports & sockets', title: 'Transport: ports, sockets, connections', click: 'Static.' },
        { id: 't16b', part: 'udp', stop: '16b', short: 'UDP header', title: 'The UDP header', click: 'Static.' },
        { id: 't16c', part: 'tcp', stop: '16c', short: 'TCP header', title: 'The TCP header', click: 'Static.' },
        { id: 't16d', part: 'sockets', stop: '16d', short: 'Berkeley sockets', title: 'Berkeley sockets', click: 'Static.' }
      ],
      syllabus: 'Transport Service, Berkeley Sockets, Elements of Transport Protocols: Addressing, UDP, TCP Segment Header',
      problem: 'IP delivers to a host, not to a program, and promises nothing.',
      but: 'TCP promises a reliable stream, but both ends must first agree they\'re talking, over a network that loses and delays packets.',
      live: '"IP got \'Hi\' to the machine. Ports get it to the program. UDP adds just that, plus a checksum: 8 bytes. TCP adds a sequence number, an ACK, a window and flags: 20 bytes, because it promises much more. But that promise needs both ends to agree they\'re talking first, over a network that loses and delays packets."',
      click: 'Hover any header field for its role. "What UDP doesn\'t do" greys out the TCP-only fields. Cards: Berkeley sockets.',
      facts: [
        'Transport address = port (Tanenbaum: TSAP). Socket = (IP address, port). A TCP connection is identified by the 5-tuple: protocol, source IP, source port, destination IP, destination port.',
        'Well-known ports (below 1024): 25 SMTP, 53 DNS, 80 HTTP, 443 HTTPS.',
        'UDP header 8 bytes: source port, destination port, length, checksum (16 bits each). No connection, no ACKs, no ordering, no flow or congestion control.',
        'TCP header 20 bytes minimum, 60 maximum: the header length (data offset) counts 32-bit words, 5–15. Ports, sequence number, acknowledgement number, header length, 8 flags (CWR ECE URG ACK PSH RST SYN FIN), window size, checksum, urgent pointer, options (0–40 bytes).',
        'TCP numbers bytes, not segments: the sequence number is the first data byte\'s number; the ACK is the next byte expected.',
        'UDP and TCP checksums cover a pseudoheader (source and destination IP, protocol, length) as well as header and data.',
        'Berkeley sockets: server SOCKET → BIND → LISTEN → ACCEPT (blocks); client SOCKET → CONNECT; both SEND / RECEIVE; CLOSE.'
      ],
      example: 'UDP 8 bytes · TCP 20 bytes (header length 5) to 60 bytes (header length 15).',
      qa: [
        ['Why does UDP exist if TCP is reliable?', 'No setup and 8 bytes of overhead: one-request/one-reply protocols (DNS), real-time media that would rather lose a late packet than stall, and protocols that do their own reliability (QUIC).'],
        ['Why does TCP need a header length field?', 'Options make the header 20–60 bytes. The field, in 32-bit words (5–15), says where the data starts.'],
        ['What is the pseudoheader for?', 'It puts the IP addresses and protocol into the checksum, so a segment delivered to the wrong host is caught. It is never sent, and it breaks strict layering.']
      ]
    },
    {
      id: 't17', topic: 17, stop: '17', act: 7, hero: true, short: 'Connect & release', title: 'Connection establishment & release', target: 0,
      subs: [
        { id: 't17', part: 'normal', stop: '17a', short: 'Three-way handshake', title: 'Three-way handshake', click: 'Step = one tick. Tap an arrow in flight to lose it (tap the lost one to bring it back). The states show under Client and Server.' },
        { id: 't17b', part: 'oldsyn', stop: '17b', short: 'Old duplicate SYN', title: 'Delayed duplicate: old SYN', click: 'Step = one tick.', predict: { q: 'A stale SYN reaches the server: does a connection open?', a: 'No: SYN+ACK ack=701, the client answers RST' } },
        { id: 't17c', part: 'oldsynack', stop: '17c', short: 'Old SYN + old ACK', title: 'Delayed duplicates: old SYN and old ACK', click: 'Step = one tick.' },
        { id: 't17d', part: 'release', stop: '17d', short: 'Release', title: 'Connection release', click: 'Step = one tick.' },
        { id: 't17e', part: 'synflood', stop: '17e', short: 'SYN flood', title: 'SYN flood and SYN cookies', click: 'Static.' }
      ],
      syllabus: 'Connection Establishment, Connection Release, TCP Connection Establishment and Release',
      problem: 'Set up a connection when the setup packets themselves can be lost, delayed or duplicated.',
      but: 'The connection is open. A fast sender can now bury a slow receiver.',
      history: 'The three-way handshake: Tomlinson, 1975.',
      live: '"Each side picks its own starting number and the other must echo it plus one. Three messages, because a delayed duplicate SYN from an old connection must not open a new one. Watch: the old SYN gets a SYN+ACK, the client never sent it, so it answers RST. Closing is harder: the two-army problem says no finite exchange makes both sides sure, so TCP closes each direction with FIN and ACK and lets a timer finish it. But now the connection is open, and a fast sender can bury a slow receiver."',
      click: 'Tabs: Normal · Old duplicate SYN · Old SYN + old ACK · Release. S steps, Run plays, "Show all" finishes. Normal tab: click an arrow in flight (or a Lose button) to lose it. x and y are editable.',
      facts: [
        'Three-way handshake: SYN seq=x → SYN+ACK seq=y ack=x+1 → ACK seq=x+1 ack=y+1. Each side picks its own initial sequence number (ISN); SYN and FIN each use up one sequence number.',
        'Old duplicate SYN (x\'): the server answers SYN+ACK seq=y ack=x\'+1; the client never sent x\', so it replies RST.',
        'Old SYN + old ACK: the old ACK carries ack=z; z ≠ y+1, so the server rejects it. The server\'s own ISN must be echoed.',
        'Release: two-army problem: no protocol with a finite number of messages makes both sides sure. TCP: FIN → ACK in each direction, then timers.',
        'TIME_WAIT = 2 × MSL on the side that closes first: a lost final ACK can be resent, and old segments die before the port pair is reused.',
        'SYN flood: half-open connections fill the server\'s table. SYN cookies: encode the state in the server\'s ISN and keep nothing until the final ACK.'
      ],
      example: 'x = 1000, y = 5000: SYN 1000 → SYN+ACK 5000, ack 1001 → ACK 1001, ack 5001.',
      qa: [
        ['Why not a two-way handshake?', 'The server could not tell a delayed duplicate SYN from a new one, and would open a connection nobody asked for. The third message proves the client saw the server\'s y.'],
        ['Why pick ISNs that are not 0?', 'So segments from an old connection on the same ports fall outside the new sequence space, and so an attacker can\'t guess y and forge the third message.'],
        ['Why is TIME_WAIT 2 MSL?', 'One MSL for the last ACK to travel and one for a resent FIN to come back. After that no segment from this connection is still alive.'],
        ['What if the final ACK is lost?', 'A pure ACK has no timer. The server\'s SYN+ACK timer fires, it resends SYN+ACK, and the client ACKs again (Normal tab, lose the ACK).']
      ]
    },
    {
      id: 't18', topic: 18, stop: '18', act: 7, short: 'Flow control', title: 'Flow control & buffering', target: 0,
      subs: [
        { id: 't18', part: 'window', stop: '18a', short: 'Window management', title: 'Flow control: window management', click: 'Step plays the next action of Tanenbaum\'s sequence (4096-byte buffer).' },
        { id: 't18b', part: 'nagle', stop: '18b', short: 'Nagle', title: 'Nagle\'s algorithm', click: 'Static.' },
        { id: 't18c', part: 'clark', stop: '18c', short: 'Clark', title: 'Silly window syndrome: Clark\'s fix', click: 'Static.' }
      ],
      syllabus: 'Flow Control and Buffering, Sliding Window',
      problem: 'The sender can send faster than the receiver\'s application reads.',
      but: 'The window needs ACKs. If an ACK is late, when should the sender give up and resend?',
      live: '"The receiver has a 4 KB buffer, and every ACK says how much of it is free. Write 2 KB: window 2048. Write 2 KB more: window 0, the sender must stop. The app reads 2 KB: window 2048 again. Now lose that update: the sender waits for a window, the receiver waits for data, a deadlock. The persist timer breaks it with a 1-byte probe. But all of this runs on ACKs. If an ACK is late, when should the sender give up and resend?"',
      click: '"Sender writes 2 KB" twice, "App reads 2 KB". Then arm "Lose window update", read again, write (blocked), "Persist timer fires". Buffer size is editable.',
      facts: [
        'The receiver buffers data until its application reads it. Every ACK carries a window = free buffer space in bytes.',
        'Tanenbaum\'s sequence, 4 KB buffer: write 2 KB → ACK=2048 WIN=2048; write 2 KB → ACK=4096 WIN=0, sender blocks; app reads 2 KB → ACK=4096 WIN=2048.',
        'Window 0: the sender may send only urgent data or a 1-byte window probe. The persist timer sends the probe, so a lost window update can\'t deadlock the connection.',
        'Sliding window over bytes: sent and ACKed | sent, not ACKed | may send | may not send yet (stop 5, counted in bytes).',
        'Nagle: when data arrive a byte at a time, send the first piece and buffer the rest until it is ACKed.',
        'Clark (silly window syndrome): the receiver should not announce a tiny window; wait until it can take a maximum segment or half its buffer is empty.'
      ],
      example: '4096-byte buffer: WIN 2048 → 0 → 2048.',
      qa: [
        ['Flow control or congestion control?', 'Flow control protects the receiver (its window); congestion control protects the network (cwnd, stop 20). The sender uses the smaller of the two.'],
        ['What if the window update is lost?', 'Deadlock: each side waits for the other. The persist timer makes the sender probe; the reply re-announces the window.'],
        ['Nagle and Clark together?', 'Complementary: Nagle stops the sender sending tiny segments, Clark stops the receiver asking for them.']
      ]
    },
    {
      id: 't19', topic: 19, stop: '19', act: 7, short: 'Timer management', title: 'Timer management: RTO', target: 0,
      subs: [
        { id: 't19', part: 'formulas', stop: '19a', short: 'RTO formulas', title: 'Timer management: the RTO formulas', click: 'Static.' },
        { id: 't19b', part: 'table', stop: '19b', short: 'RTO worked', title: 'RTO worked example', click: 'Step reveals the next sample. Final RTO 325.0390625 ms. E: your RTT samples (* = retransmitted).' },
        { id: 't19c', part: 'karn', stop: '19c', short: 'Karn', title: 'Karn\'s algorithm', click: 'Step reveals the next sample; sample 3 is a retransmission. E: your RTT samples (* = retransmitted).' }
      ],
      syllabus: 'Timer Management',
      problem: 'Too short a timeout floods the net with duplicates; too long stalls on every loss.',
      but: 'The timer protects one connection. In stop 14 the router could only drop or mark packets; it\'s the senders that must slow down.',
      history: 'Jacobson, 1988, after the 1986 congestion collapses.',
      live: '"On one wire the round trip is fixed. Across the Internet it varies widely, so the timeout must learn. Keep a smoothed RTT and a smoothed deviation; the timeout is the average plus four deviations. Order matters: RFC 6298 updates the deviation with the old average first, 272.5; doing it the other way gives 270. And Karn: never time a retransmitted segment, because the ACK can\'t say which copy it answers. But the timer only protects one connection. The router in stop 14 could only drop or mark; it\'s the senders that must slow down."',
      click: 'Type RTT samples (comma separated). Order toggle: RFC 6298 / SRTT first. Tick "retx" on a row for Karn\'s rule.',
      facts: [
        'First sample R: SRTT = R, RTTVAR = R/2.',
        'Then (RFC 6298): RTTVAR = ¾·RTTVAR + ¼·|SRTT − R| using the OLD SRTT, then SRTT = ⅞·SRTT + ⅛·R.',
        'RTO = SRTT + 4·RTTVAR. RFC 6298 also sets a 1 s minimum RTO (left out so the arithmetic stays visible).',
        'Samples 100, 120, 80, 200 ms → RTO 300, 272.5, 249.6875, 325.0390625 ms. SRTT first instead: 300, 270, 245, 308.984375.',
        'Karn: ignore RTT samples from retransmitted segments; double the RTO on each timeout until a segment gets through the first time.'
      ],
      example: '100 → 300; 120 → RTTVAR 42.5, SRTT 102.5, RTO 272.5.',
      qa: [
        ['Why 4 × RTTVAR?', 'Jacobson\'s choice: multiplying by 4 is a shift, and fewer than 1% of packets arrive more than four deviations late (Tanenbaum).'],
        ['Why does the update order matter?', 'RTTVAR measures how far the new sample is from the estimate before it. Updating SRTT first moves the estimate toward the sample and shrinks the deviation: 270 instead of 272.5.'],
        ['Why Karn\'s rule?', 'After a retransmission the ACK can\'t say which copy it answers, so the sample may be wrong by a whole RTO. Skip it and back off by doubling instead.'],
        ['Tanenbaum\'s α and β?', 'α = 7/8 weights the old SRTT, β = 3/4 the old RTTVAR. Forouzan writes the same rule with weight 1/8 on the new sample.']
      ]
    },
    {
      id: 't20', topic: 20, stop: '20', act: 7, hero: true, short: 'TCP congestion', title: 'TCP congestion control', target: 0,
      subs: [
        { id: 't20', part: 'tahoe', stop: '20a', short: 'Tahoe', title: 'TCP congestion control: Tahoe', click: 'Step = one round (ssthresh 32, capacity 39). Capacity and ssthresh sliders (shared with 20b and the 20c road). C: challenge.', predict: { q: 'Loss at cwnd 40: what does Tahoe do next?', a: 'cwnd 1, ssthresh 20' } },
        { id: 't20b', part: 'reno', stop: '20b', short: 'Reno', title: 'TCP congestion control: Reno', click: 'Step = one round. Capacity and ssthresh sliders (shared with 20a and the 20c road).', predict: { q: 'Loss at cwnd 40 by 3 duplicate ACKs: what does Reno do next?', a: 'cwnd 20 = new ssthresh (fast recovery)' } },
        { id: 't20c', part: 'road', stop: '20c', short: 'Traffic road', title: 'The congestion road', click: 'Step = one round; one vehicle per segment. Follows the capacity and ssthresh set on 20a/b.' },
        { id: 't20d', part: 'collapse', stop: '20d', short: 'Collapse of 1986', title: 'Congestion collapse, 1986', click: 'Static.' },
        { id: 't20e', part: 'aimd', stop: '20e', short: 'AIMD is fair', title: 'Why AIMD is fair', click: 'Static.' },
        { id: 't20f', part: 'ecn', stop: '20f', short: 'ECN', title: 'Explicit congestion notification', click: 'Static.' }
      ],
      syllabus: 'Congestion Control (TCP)',
      problem: 'Every TCP must find its fair share of a bottleneck it can\'t see, using only drops (and ECN marks) as signals.',
      but: 'TCP now delivers \'Hi\' reliably and fairly. But the phone never knew the server\'s IP, only its name.',
      history: 'October 1986: LBL to UC Berkeley throughput fell from 32 kbps to 40 bps. Jacobson\'s fix, 1988.',
      live: '"Stop 14\'s router can only drop or mark packets. TCP can\'t see the router, so it probes: double every round until it hits the threshold, then add one. A loss means the router is full: halve the threshold and back off. Tahoe starts again from 1; Reno, on three duplicate ACKs, carries on from the new threshold. Watch the road: the toll booth holds 39 per round trip, so the 40th truck is wrecked. But the phone never knew the server\'s IP, only its name."',
      click: 'S steps a round, Space plays/pauses, R resets. Tahoe/Reno toggle; loss type; ssthresh and router capacity inputs. Mouse on the road: drag rotates, right-drag moves, scroll zooms, double-click resets the view. G shows/hides the graph; W hides graph and controls (road only); L switches live → replay → sim.',
      facts: [
        'The sender keeps a congestion window cwnd and may have min(cwnd, receiver window) in flight.',
        'Slow start: cwnd = 1 segment, doubles every RTT up to ssthresh. Congestion avoidance: +1 segment per RTT (additive increase).',
        'Loss: ssthresh = cwnd / 2. Timeout → cwnd = 1, slow start again. 3 duplicate ACKs → fast retransmit; Tahoe still sets cwnd = 1, Reno\'s fast recovery sets cwnd = ssthresh (multiplicative decrease).',
        'Default: ssthresh 32, router capacity 39 → loss in round 14 at cwnd 40 → ssthresh 20. Tahoe: …39 40 1 2 4 8 16 20 21…; Reno: …39 40 20 21 22…',
        'AIMD converges to fairness: additive increase moves two flows parallel to the 45° line, halving moves them toward the origin, so they meet the fair line (Chiu & Jain, 1989).',
        'ECN (stop 14): the router marks instead of dropping; the receiver echoes ECE; the sender halves cwnd and sets CWR.'
      ],
      example: 'Tahoe 1 2 4 8 16 32 33 … 40 1 2 4 8 16 20 21 22 23 24 · Reno … 40 20 21 … 29.',
      qa: [
        ['Why is it called slow start if it doubles?', 'Slow compared with sending the whole receiver window at once, which is what TCP did before 1988.'],
        ['Why does Reno not drop to 1 on 3 duplicate ACKs?', 'Duplicate ACKs mean later segments still get through, so the network is only mildly congested; halving is enough. A timeout means nothing gets through: start again from 1.'],
        ['Is the app\'s Reno exactly RFC 5681?', 'It is Tanenbaum\'s simplification: cwnd = new ssthresh. RFC 5681 inflates cwnd by 3 (plus 1 per further duplicate ACK) during recovery, then deflates to ssthresh.'],
        ['Is the road live data?', 'Only in LIVE mode (badge). SIMULATION follows the graph exactly; RECORDED is my laptop\'s capture. Live shows protocols and sizes, never addresses or ports.']
      ]
    },

    /* ---------- Act 8 · Names, pages and secrets (Unit V) ---------- */
    {
      id: 't21', topic: 21, stop: '21', act: 8, hero: true, short: 'DNS', title: 'DNS: the Domain Name System', target: 0,
      subs: [
        { id: 't21', part: 'iterative', stop: '21a', short: 'Iterative DNS', title: 'DNS: iterative resolution', click: 'Step = one message, drawn on the name hierarchy (no map: root and TLD servers are anycast). Cached: tap com NS, example.com NS or www A to skip levels. C: challenge.' },
        { id: 't21b', part: 'recursive', stop: '21b', short: 'Recursive DNS', title: 'DNS: recursive resolution', click: 'Step = one message, drawn on the name hierarchy. Cached: tap a record to skip levels.' },
        { id: 't21c', part: 'records', stop: '21c', short: 'Resource records', title: 'DNS resource records', click: 'Static.' }
      ],
      syllabus: 'DNS',
      problem: 'People type names; IP needs addresses.',
      but: 'Now the phone can reach the server. What does it actually ask for, and how is the reply delivered fast to millions?',
      live: '"Nobody could keep one list of every name on Earth, so DNS is a tree. The resolver asks the root, which only knows who runs .com; .com only knows who runs example.com; that server knows the answer. Three questions from the resolver, then it caches the answer for its TTL, so the second lookup is instant until the TTL runs out. Now the phone can reach the server. What does it actually ask for, and how does the reply reach millions of people fast?"',
      click: 'Type a name (2–4 labels). S steps one message, Run plays. Iterative/Recursive toggle. Press "Look up" again within 30 s: cache hit; the TTL counts down, then the tree is walked again.',
      facts: [
        'The walk is drawn on the name tree, not a map: root and TLD servers are anycast (one address served from many sites), so no single place is right.',
        'Hierarchy: root → top-level domain (com, org, in…) → authoritative server for the zone. A zone is a separately administered part of the tree.',
        'Iterative: the resolver asks each server in turn; each replies with a referral or the answer. Recursive: the server asked finds the full answer itself. Hosts ask their local resolver recursively; the resolver usually queries iteratively.',
        'Caching: answers are kept for their TTL (seconds); TLD referrals are cached too, so the root is rarely asked.',
        'Records: A (IPv4), AAAA (IPv6), NS (name server for a zone), MX (mail server, with a preference), CNAME (alias); also SOA, PTR, TXT.',
        'DNS uses UDP port 53 (TCP for large replies and zone transfers).'
      ],
      example: 'www.example.com, iterative: root → referral to .com → referral to example.com → A 192.0.2.10. 3 queries from the resolver.',
      qa: [
        ['Why not one central DNS server?', 'A single point of failure, all the traffic in one place, far from most users, and one database to update for every host on Earth. A tree with caching scales.'],
        ['Iterative or recursive?', 'Recursive loads the servers asked but lets them cache; iterative keeps root and TLD servers simple. In practice: recursive to the local resolver, iterative from it.'],
        ['What does the TTL trade?', 'Long TTL: fewer queries but stale answers after a change. Short TTL: fresh but more load. The demo uses 30 s so it expires on screen.']
      ]
    },
    {
      id: 't22', topic: 22, stop: '22', act: 8, short: 'WWW, HTTP & CDN', title: 'The Web: HTTP, caches and CDNs', target: 0,
      subs: [
        { id: 't22', part: 'request', stop: '22a', short: 'URL & request', title: 'The Web: URLs and HTTP requests', click: 'Step takes the URL apart: 1 pieces, 2 DNS + port + TCP, 3 request, 4 response. URL chips: http, https (443 + TLS), :8080 · .png (port in Host:, image/png).', predict: { q: 'The URL names no port: which port does the browser connect to?', a: '80, http\'s default (443 for https)' } },
        { id: 't22b', part: 'rtts', stop: '22b', short: 'Connections', title: 'HTTP: non-persistent vs persistent', click: 'Static: 1 HTML + 10 images, RTT 100 ms.' },
        { id: 't22c', part: 'scale', stop: '22c', short: 'Caches & CDNs', title: 'Bringing the page closer: caches and CDNs', click: 'Step moves origin → proxy → farm → CDN.' },
        { id: 't22d', part: 'methods', stop: '22d', short: 'Methods & status', title: 'HTTP methods and status codes', click: 'Static.' },
        { id: 't22e', part: 'http2', stop: '22e', short: 'HTTP/2 & HTTP/3', title: 'HTTP/2 and HTTP/3', click: 'Static.' },
        { id: 't22f', part: 'p2p', stop: '22f', short: 'P2P', title: 'Peer-to-peer: BitTorrent', click: 'Static.' }
      ],
      syllabus: 'WWW, Architecture, HTTP, Content Delivery, Server Farms, Web Proxies, Peer-to-Peer Networks',
      problem: 'Fetch a page made of dozens of objects from a server far away.',
      but: 'The web pulls. Mail must be pushed to someone who isn\'t online.',
      live: '"A page is one HTML file plus every image it names. If each object needs its own TCP connection, that\'s two round trips each: 22 for this page. Keep the connection open: 12. Send all the requests without waiting: 3. Then bring the page closer: a proxy near the users, a server farm behind one address, and a CDN, where DNS from the last stop sends you to the nearest copy. But the web pulls. Mail has to be pushed to someone who isn\'t online."',
      click: 'Objects and RTT inputs; the three timelines redraw. Cards: request/response, HTTP/2–3, P2P. Click a box on the scale strip.',
      facts: [
        'URL = scheme://host[:port]/path. Scheme → the default port (http 80, https 443) unless the URL gives one; host → DNS → the address, and also the Host: header; path → the request line. Then TCP to address:port (TLS first for https), send the request, then fetch each embedded object.',
        'Host: carries the port only when it isn\'t the scheme\'s default (RFC 9110 §7.2): http://www.example.com:8080/a/b.png → Host: www.example.com:8080. Content-Type tells the browser how to read the body (text/html vs image/png); Content-Length = the body\'s bytes.',
        'Request: method (GET, HEAD, POST, PUT, DELETE…) path version, then headers (Host: is required in HTTP/1.1). Response: status line, headers, body. 1xx info, 2xx success, 3xx redirect, 4xx client error, 5xx server error.',
        'RTT count, transmission time ignored (as in Kurose & Ross), 1 HTML + 10 images: non-persistent 2(1+10) = 22; persistent 2 + 10 = 12; pipelined 2 + 1 = 3.',
        'HTTP/2: many streams over one TCP connection, binary frames, header compression; a lost TCP segment still blocks every stream (head-of-line blocking). HTTP/3: QUIC over UDP 443; a loss blocks only its own stream.',
        'Caching: browser and proxy caches; a conditional GET (If-Modified-Since) gets 304 Not Modified if the copy is still good.',
        'Server farm: a front end (load balancer) spreads requests over many servers. CDN: DNS returns the nearest edge node, which serves a cached copy.',
        'P2P (BitTorrent): a torrent file names a tracker; peers swap chunks; tit-for-tat favours peers that upload; a DHT can replace the tracker.'
      ],
      example: '1 + 10 objects: 22 / 12 / 3 RTT.',
      qa: [
        ['Why does pipelining help so much?', 'All ten requests leave back to back, so their round trips overlap: one RTT for the images instead of ten.'],
        ['Proxy or CDN?', 'A proxy caches near the clients, for whatever they fetch. A CDN is paid for by the content owner and puts copies near everyone; DNS steers each client to the nearest.'],
        ['Why did HTTP/3 move to UDP?', 'TCP delivers bytes in order, so one lost segment stalls every HTTP/2 stream. QUIC does reliability per stream on top of UDP and merges the transport and TLS handshakes.']
      ]
    },
    {
      id: 't23', topic: 23, stop: '23', act: 8, short: 'E-mail', title: 'Electronic mail', target: 0,
      subs: [
        { id: 't23', part: 'path', stop: '23a', short: 'Mail path', title: 'Electronic mail: the path', click: 'Static.' },
        { id: 't23b', part: 'smtp', stop: '23b', short: 'SMTP', title: 'SMTP dialogue', click: 'Step = one line.' },
        { id: 't23c', part: 'parts', stop: '23c', short: 'Envelope & header', title: 'Envelope, header and body', click: 'Static.' },
        { id: 't23d', part: 'mime', stop: '23d', short: 'MIME', title: 'MIME and base64', click: 'Static.' }
      ],
      syllabus: 'E-mail',
      problem: 'Deliver a message to a user who is offline, on another system.',
      but: 'Every SMTP hop, router and Wi-Fi access point on the way can read the mail in plain text.',
      live: '"Alice\'s mail program hands the message to her provider\'s server, which pushes it with SMTP to Bob\'s provider over TCP port 25. There it waits in Bob\'s mailbox until he connects and pulls it with IMAP. The SMTP dialogue is plain text: HELO, MAIL FROM, RCPT TO, DATA, a line with a dot, QUIT. Attachments are bytes, so MIME wraps them in base64. But that plain text means every hop on the way can read the mail."',
      click: 'S steps the SMTP dialogue. Type text in the MIME box to see its base64. Click envelope / header / body.',
      facts: [
        'User agents (compose, read) and message transfer agents (mail servers). Alice\'s UA → her MTA → SMTP over TCP 25 → Bob\'s MTA → Bob\'s mailbox → Bob\'s UA pulls with IMAP (or POP3).',
        'SMTP: 220 greeting; HELO, MAIL FROM, RCPT TO each answered 250; DATA → 354; the message ends with a line holding only "."; 250; QUIT → 221.',
        'Envelope (MAIL FROM, RCPT TO: used for delivery) vs header (From:, To:, Subject:, Date: shown to the user) vs body.',
        'Messages are 7-bit ASCII text. MIME adds MIME-Version, Content-Type (text/plain, image/jpeg, multipart/mixed…) and Content-Transfer-Encoding: base64 turns every 3 bytes into 4 characters.',
        'Final delivery is a pull: SMTP needs the receiver online, so mail waits on the provider\'s server. IMAP keeps mail on the server; POP3 downloads it.'
      ],
      example: '"Hi" → base64 "SGk=". 3 bytes → 4 characters; = pads the last group.',
      qa: [
        ['Why can\'t Bob\'s laptop receive SMTP directly?', 'SMTP pushes, so the receiver must be online at a known address. The provider\'s server always is; Bob pulls when he connects.'],
        ['Why base64?', 'SMTP carries 7-bit ASCII lines; base64 maps every 3 bytes to 4 safe characters, 33% bigger.'],
        ['Envelope vs header?', 'MTAs deliver by the envelope (RCPT TO). Bcc proves it: Bcc recipients are in the envelope but not in the To: header.']
      ]
    },
    {
      id: 't24', topic: 24, stop: '24', act: 8, hero: true, short: 'Classical ciphers', title: 'Cryptography: substitution & transposition', target: 0,
      subs: [
        { id: 't24', part: 'caesar', stop: '24a', short: 'Caesar', title: 'Substitution: Caesar cipher', click: 'Dial k 0–25: the mapping and ATTACK\'s ciphertext follow. C: challenge (dial the intercepted WHJRLAZ back to English).' },
        { id: 't24b', part: 'mono', stop: '24b', short: 'Monoalphabetic', title: 'Substitution: monoalphabetic cipher', click: 'Static.' },
        { id: 't24c', part: 'freq', stop: '24c', short: 'Frequency attack', title: 'Breaking it: letter frequencies', click: 'Step 1 = pass 1 (rank-match: 6 of 13 right, wrong in red). Each later Step fixes one letter from a trigram or digram (the, er, an, and, ion); 7 fixes. Tap a cipher letter to try the next plaintext letter for it (on top of the Step\'s guess).' },
        { id: 't24d', part: 'columnar', stop: '24d', short: 'Transposition', title: 'Columnar transposition', click: 'Static: key MEGABUCK.' },
        { id: 't24e', part: 'symmetric', stop: '24e', short: 'DES → AES', title: 'Symmetric key: DES → AES', click: 'Static.' }
      ],
      syllabus: 'Network Security, Introduction to Cryptography, Substitution Ciphers, Transposition Ciphers, Symmetric-Key Algorithms',
      problem: 'Anyone on the path can read \'Hi\'.',
      but: 'Both sides need the same secret key. How do they agree on it over the same insecure path?',
      history: 'Kerckhoffs, 1883: assume the enemy knows the method; only the key is secret.',
      live: '"The oldest fix is to replace each letter: Caesar shifts by 3, ATTACK becomes DWWDFN, with only 25 keys to try. Any permutation of the alphabet gives 26 factorial keys, but look at the frequency chart: E is still the most common letter, so it falls in minutes. Transposition keeps the letters and scrambles their order: Tanenbaum\'s MEGABUCK. Modern ciphers like AES mix both, many rounds over. But both sides need the same secret key. How do they agree on it over the same insecure path?"',
      click: 'Tabs: Caesar · Monoalphabetic · Columnar transposition. Every tab has Encrypt/Decrypt and takes any input. Shuffle makes a new monoalphabetic key.',
      facts: [
        'Plaintext P, key K: C = E_K(P), P = D_K(C). Kerckhoffs\'s principle: the algorithm is public; only the key is secret.',
        'Caesar: shift each letter by k. k = 3: ATTACK → DWWDFN. Only 25 useful keys.',
        'Monoalphabetic: any permutation of 26 letters, 26! ≈ 4 × 10²⁶ keys, but letter frequencies survive (E T A O I N…), so frequency analysis breaks it.',
        'Columnar transposition: write the plaintext in rows under the key, pad, read columns in alphabetical key order. MEGABUCK: pleasetransferonemilliondollarstomyswissbankaccountsixtwotwo + abcd → AFLLSKSOSELAWAIATOOSSCTCLNMOMANTESILYNTWRNNTSOWDPAEDOBUOERIRICXB.',
        'Repeated key letters (the app\'s rule): equal letters rank left to right. BALL + helloworld(ab) → EWDHOLLOALRB.',
        'Symmetric key: the same key encrypts and decrypts. DES (1977): 64-bit blocks, 56-bit key, broken by brute force in 1998. AES (Rijndael, 2001): 128-bit blocks, 128/192/256-bit keys.'
      ],
      example: 'ATTACK, k=3 → DWWDFN · MEGABUCK → AFLLSKSO… · BALL/helloworld → EWDHOLLOALRB.',
      qa: [
        ['Why are 26! keys not enough?', 'Nobody tries keys: the most common ciphertext letter is probably E, common pairs give TH and IN. A few hundred letters of ciphertext are enough.'],
        ['How do you break a transposition?', 'Its letter frequencies are normal English, which gives it away. Guess a probable word, try column counts until it appears, then order the columns.'],
        ['What does AES do differently?', 'It substitutes (S-box) and transposes/mixes in each of 10–14 rounds, on 128-bit blocks, so no single-letter pattern survives.']
      ]
    },
    {
      id: 't25', topic: 25, stop: '25', act: 8, hero: true, short: 'RSA & public key', title: 'Public-key cryptography: RSA', target: 0,
      subs: [
        { id: 't25', part: 'keys', stop: '25a', short: 'RSA keys', title: 'RSA: key generation', click: 'p 3, q 11, d 7. E: your p q d. p and q chips (26 < n ≤ 150), d slider over the valid d; d = 2 is the break (no e).' },
        { id: 't25b', part: 'encrypt', stop: '25b', short: 'RSA encrypt', title: 'RSA: encrypt and decrypt', click: 'The mod-33 dial: Step = one square-and-multiply hop, encrypt then decrypt, letter by letter. E: your p q d (dial while n ≤ 150, else the table). Tap a letter in the table to run only its hops.' },
        { id: 't25c', part: 'compare', stop: '25c', short: 'Symmetric vs public', title: 'Symmetric vs public key', click: 'Static.' },
        { id: 't25d', part: 'firewall', stop: '25d', short: 'Firewall', title: 'Firewalls', click: 'Static.' },
        { id: 't25e', part: 'ids', stop: '25e', short: 'IDS', title: 'Intrusion detection', click: 'Static.' }
      ],
      syllabus: 'Public Key Algorithms, RSA, Firewalls, Intrusion Detection System',
      problem: 'Share a key with someone you\'ve never met, over a public channel.',
      but: 'Framed, checked, routed, delivered, named, fetched — and now private. \'Hi\' arrives.', butLabel: 'CLOSE',
      history: 'Diffie & Hellman, 1976; Rivest, Shamir & Adleman, MIT, 1978.',
      live: '"Use two keys: anyone can lock with the public one, only I can unlock with the private one. RSA: pick two primes, here Tanenbaum\'s 3 and 11. n is 33, z is 20, d is 7, and e is 3 because 3 times 7 is 1 more than 20. SUZANNE becomes 28 21 20 1 5 5 26 and comes back. Professor, give me two primes. … In practice RSA only carries an AES key, because it\'s slow. Framed, checked, routed, delivered, named, fetched, and now private: \'Hi\' arrives."',
      click: 'Type p, q (primes ≤ 997), d and a message (letters A–Z). Rejections show their reason. Cards: symmetric vs public key, firewall, IDS.',
      facts: [
        'Public key (Diffie & Hellman, 1976): encryption key E public, decryption key D private; D(E(P)) = P; D cannot be found from E.',
        'RSA: primes p, q; n = pq, z = (p−1)(q−1); d coprime to z; e with e·d ≡ 1 (mod z). Public key (e, n), private key (d, n).',
        'C = Pᵉ mod n, P = Cᵈ mod n. Security rests on factoring n. Real keys use n of 2048 bits or more.',
        'Tanenbaum: p = 3, q = 11 → n = 33, z = 20, d = 7, e = 3. SUZANNE = 19 21 26 1 14 14 5 → 28 21 20 1 5 5 26.',
        'Symmetric vs public key: n(n−1)/2 shared keys vs 2n keys (one pair per person); RSA is far slower, so it carries a symmetric (AES) session key.',
        'Firewall: packet filter (header rules), stateful (tracks connections), application gateway (reads content). IDS: signature-based (known attacks) vs anomaly-based (deviation from normal).'
      ],
      example: 'SUZANNE: 19³ = 6859 ≡ 28 (mod 33); 28⁷ ≡ 19 (mod 33).',
      qa: [
        ['Why is this example insecure?', 'n = 33 factors at once, and one letter per block is a monoalphabetic cipher (14 → 5 every time). Real RSA uses 2048-bit n and random padding.'],
        ['Why must d be coprime to z?', 'Only then does an e with e·d ≡ 1 (mod z) exist.'],
        ['Why does decryption work?', 'e·d = 1 + k·z, and by Euler\'s theorem P^z ≡ 1 (mod n) when P is coprime to n, so P^(ed) ≡ P. It still holds when P shares a factor with n (Chinese remainder theorem).'],
        ['Firewall or IDS?', 'A firewall enforces a policy at the border (allow/deny). An IDS watches traffic and raises alarms; it can see attacks that the policy allows through.']
      ]
    },
    {
      id: 'close', kind: 'close', title: 'Close + Q&A', target: 5,
      syllabus: 'Questions',
      live: '"One message, twenty-five checkpoints, and each one exists because the one before it broke something. Ask me about any of them; every stop on this map is live."',
      click: 'Hover a stop to show the problem it solves; click it to jump there. End returns here.'
    }
  ];

  // SPEC-v5 sub-slides: an entry with subs becomes one screen per sub. Each sub inherits the
  // entry (problem, notes, syllabus) and the entry's renderer; the first keeps the time
  // target, only the last keeps the But….
  screens = screens.reduce(function (out, e) {
    if (!e.subs) { out.push(e); return out; }
    e.subs.forEach(function (sub, i) {
      var sc = {};
      Object.keys(e).forEach(function (k) { if (k !== 'subs') sc[k] = e[k]; });
      sc.screen = e.screen || e.id;
      if (i > 0) sc.target = 0;
      if (i < e.subs.length - 1) { delete sc.but; delete sc.butLabel; }
      Object.keys(sub).forEach(function (k) { sc[k] = sub[k]; });
      sc.subIndex = i; sc.base = e;   // the cheat sheet lists each original stop once
      out.push(sc);
    });
    return out;
  }, []);

  // Cumulative "ends by" per screen.
  var t = 0;
  screens.forEach(function (s) { t += s.target; s.endsBy = t; });

  // No time cuts: the talk runs as long as the stop quizzes take (SPEC-QUIZ §5).
  var cutRules = [];
  // Quiz rules with no screen or time (SPEC-QUIZ §5): printed on the cheat sheet.
  var quizRules = [
    'Quiz: → at the end of each stop asks "Take the quiz?". Y starts 5 questions, N skips to the next stop.',
    'Quiz: → and ← are off during a quiz. Space / Enter reveals and moves on; Esc ends it early.',
    'Quiz: Z starts a stop\'s quiz by hand from any of its screens.'
  ];

  var traps = [
    ['Hamming layout', 'Positions 1…n from the left; check bits at powers of 2', '(7,4) with parity equations and a different layout', 'Tanenbaum; mention the difference if asked'],
    ['ACK number', 'Last frame received correctly', 'Next frame expected', 'Toggle on S5'],
    ['CRC terms', 'Frame M(x), generator G(x), checksum', 'Dataword, divisor, codeword, syndrome', 'Both labels shown'],
    ['SR acknowledgements', 'Protocol 6: cumulative ACK piggybacked, plus NAK', 'Selective (per-frame) ACKs', 'Per-frame ACKs + NAK, so only frame 1 is resent']
  ];

  function fmt(sec) {
    var neg = sec < 0; sec = Math.abs(Math.round(sec));
    return (neg ? '−' : '') + Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2);
  }

  // Short label for a screen: "S7b Ethernet MAC" for stops, the title otherwise.
  function label(s) { return s.stop ? 'S' + s.stop + ' ' + s.short : s.title; }

  // A topic's problem line (its first sub-screen's), for the map hover.
  function topicProblem(n) {
    for (var i = 0; i < screens.length; i++) if (screens[i].topic === n) return screens[i].problem;
    return '';
  }

  // Index → / ← lands on from i (dir +1 / −1). The podium is skipped unless podiumOn (quiz up and someone scored).
  function stepIndex(i, dir, podiumOn) {
    var j = i + dir;
    while (j >= 0 && j < screens.length && screens[j].kind === 'podium' && !podiumOn) j += dir;
    return j >= 0 && j < screens.length ? j : i;
  }

  // Number of checkpoints = number of topics that have a stop screen (title, close, index.html follow it).
  var stopCount = (function () {
    var seen = {};
    screens.forEach(function (s) { if (s.topic) seen[s.topic] = true; });
    return Object.keys(seen).length;
  })();
  var deckTitle = 'One Message, ' + stopCount + ' Checkpoints';
  screens[0].title = deckTitle;

  CN.content = { screens: screens, topics: topics, acts: acts, stopCount: stopCount, deckTitle: deckTitle, cutRules: cutRules, quizRules: quizRules, traps: traps, fmt: fmt, label: label, topicProblem: topicProblem, stepIndex: stepIndex };
})(typeof window !== 'undefined' ? window : globalThis);
