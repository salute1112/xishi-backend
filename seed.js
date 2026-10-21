const db = require('./db');

const letterData = [
  { id: 14, title: '谢谢你们，我决定再试一次', content: '上个月在这里写过一封很丧的信，没想到收到了好多陌生人的回信。你们的话我一条条都看了，哭了很久，也想了很久。今天我重新投了简历，出门前还化了个妆。谢谢你们，我想再好好活一次。', sender: '重新出发', stamp: 'lake', vis: 'all', date: '2026-10-18 09:20:00',
    replies: [['看到你这样真的太好了，祝你面试顺利，一切都会好起来的！', '西东同学', '2026-10-18 12:00:00']] },
  { id: 13, title: '爸爸好像老了', content: '国庆回家，发现爸爸上楼开始喘气，看手机要把字调到最大。他还想像从前那样把我当小孩，往我碗里夹菜，可手有点抖。我忽然鼻子一酸。原来大人也是会老的，只是我一直没敢承认。', sender: '北岛', stamp: 'forest', vis: 'all', date: '2026-10-15 20:30:00', replies: [] },
  { id: 12, title: '确诊焦虑症之后', content: '拿着诊断书坐在医院走廊，我反而松了口气——原来那些睡不着、心慌、莫名想哭的时刻，不是我矫情，是真的生病了。我在按时吃药，也在学着和它相处。给同样在努力的你，一个隔空的拥抱。', sender: '慢慢会好的', stamp: 'desert', vis: 'all', date: '2026-10-08 15:10:00', replies: [] },
  { id: 11, title: '异地恋的第三年', content: '隔着一千两百公里，我们靠手机维持着这段感情。看见别的情侣牵手散步，我会羡慕；生病的时候他不在身边，我也会偷偷难过。但每次视频看到他笑，我又觉得，再等等，一切都值得。', sender: '半糖', stamp: 'mid-autumn', vis: 'all', date: '2026-09-25 22:00:00', replies: [] },
  { id: 10, title: '三十岁，我开始学着接纳自己', content: '今年三十了。搁以前，我大概会很焦虑：没结婚，没买房，没活成别人期待的样子。但奇怪的是，我现在反而平静了。我开始允许自己普通，允许自己慢一点。这算不算是一种长大？', sender: '小满', stamp: 'spring-festival', vis: 'all', date: '2026-09-08 08:40:00', replies: [] },
  { id: 9, title: '今天被一只猫治愈了', content: '下班路上，一只橘猫从花坛里钻出来，绕着我的脚踝蹭了好几圈。我蹲下来，它就翻出肚皮让我摸。那一瞬间，白天受的所有委屈都不算事了。小动物真的是上天派来的吧。', sender: '早八人', stamp: 'whale', vis: 'all', date: '2026-08-14 18:25:00', replies: [] },
  { id: 8, title: '和最好的朋友走散了', content: '没有吵架，也没有谁对不起谁，就是慢慢不联系了。翻聊天记录，最后一条停在三个月前。成年人体面地告别，原来连一句再见都可以省掉。我还挺想她的。', sender: '岛屿', stamp: 'fox', vis: 'all', date: '2026-07-03 21:15:00', replies: [] },
  { id: 7, title: '考研二战，我有点撑不住了', content: '这是我第二年备考。图书馆的座位从冬天坐到夏天，身边的人换了一批又一批。昨天模考成绩出来，比去年还差，我躲在楼梯间哭了很久。我不是怕输，是怕对不起一直相信我的爸妈。', sender: '上岸吧', stamp: 'panda', vis: 'all', date: '2026-06-11 23:30:00',
    replies: [['能坚持到现在，你已经比很多人都勇敢了。不管结果如何，你的努力都不会白费。', '西东同学', '2026-06-12 08:00:00']] },
  { id: 6, title: '裸辞后的第三十天', content: '一个月前头脑一热辞了职，现在每天醒来都在后悔和不后悔之间反复横跳。存款在一点点变少，说不慌是假的。但我也确实不想再回到那种把人掏空的日子里。有人能告诉我，我的选择是对的吗？', sender: '晚风', stamp: 'kyoto', vis: 'all', date: '2026-05-09 10:05:00', replies: [] },
  { id: 5, title: '有些话，只想说一个人听', content: '这封信我设成了仅一人可见。其实也没什么特别的，就是有些矫情的小心思，不想让太多人看见。如果你恰好收到了，就当是我们之间的一个小秘密吧。', sender: '西东同学', stamp: 'alpine', vis: 'one', date: '2026-04-12 14:00:00', replies: [] },
  { id: 4, title: '写给一年后的自己', content: '嗨，一年后的我，你现在过得怎么样？还在为眼下这些事焦虑吗？我赌你已经走出来了。如果还没有也没关系，慢慢来，我不催你。记得多吃饭，少熬夜，你值得被自己好好对待。', sender: '西东同学', stamp: 'africa', vis: 'all', date: '2026-04-01 09:00:00', replies: [] },
  { id: 3, title: '今天的阳光很好', content: '出门的时候，阳光正好落在身上，暖融融的。楼下的玉兰开了，白白的一树。我忽然觉得，生活好像也没有那么糟。想把这一刻的好心情分你一半，希望你那边也是晴天。', sender: '候鸟', stamp: 'lighthouse', vis: 'all', date: '2026-03-15 11:20:00', replies: [] },
  { id: 2, title: '凌晨三点的清醒', content: '又失眠了。手机屏幕的光打在天花板上，那些以为早就忘掉的人和事，一到夜里就格外清晰。我没敢跟身边的人说，怕他们觉得我矫情。写在这里，大概不会有人认识我吧。', sender: '深鲸', stamp: 'iceland', vis: 'self', date: '2026-03-02 03:00:00', replies: [] },
  { id: 1, title: '加班到凌晨的人', content: '凌晨一点半，办公室只剩我一个人。不知道为什么，突然就很想找个人说说话，哪怕对方是个陌生人。今天又被领导骂了，其实我已经很努力了，可好像怎么都做不好。你有没有过那种，明明累得不行，却不敢停下来的时刻？', sender: '小星环', stamp: 'moscow', vis: 'all', date: '2026-02-18 01:30:00',
    replies: [['收到你的信了。先深呼吸，再忙也要给自己留一点喘息的时间，你已经做得很好了。', '西东同学', '2026-02-19 07:30:00']] },
];

const postData = [
  { id: 1, content: '今天终于鼓起勇气跟喜欢的人表白了，虽然被拒绝了，但是心里反而轻松了很多。', author: '勇敢的心', date: '2026-10-18 19:00:00', likes: 23,
    responses: [['你已经很棒了！勇气本身就是胜利。', '小太阳', '2026-10-18 20:00:00']] },
  { id: 2, content: '工作三年了，越来越不知道自己想要什么。每天像个陀螺一样转，停下来就觉得空虚。', author: '迷茫的人', date: '2026-10-16 21:30:00', likes: 45,
    responses: [['我也是，但是慢慢找就好了，答案不会一下子就出现的。', '同路人', '2026-10-16 22:10:00']] },
  { id: 3, content: '今天在路上看到一只很可爱的猫，它蹭了蹭我的腿，瞬间觉得整个世界都变温柔了。', author: '猫奴一号', date: '2026-10-14 12:40:00', likes: 67, responses: [] },
];

const botBios = {
  '西东同学': '所有答案，都写在里面',
  '候鸟': '愿你我都能被温柔以待',
  '晚风': '慢慢来，比较快',
  '小太阳': '每天都要元气满满',
  '同路人': '我们都在努力生活',
};

function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) {
    console.log('已存在数据，跳过种子（users=%d）', count);
    return;
  }

  const insertUser = db.prepare(
    'INSERT INTO users (id, nickname, is_bot, bio, created_at) VALUES (?, ?, 1, ?, ?)'
  );

  // 收集所有需要的昵称
  const names = new Set();
  letterData.forEach((l) => {
    names.add(l.sender);
    l.replies.forEach((r) => names.add(r[1]));
  });
  postData.forEach((p) => {
    names.add(p.author);
    p.responses.forEach((r) => names.add(r[1]));
  });

  // 固定 bot 用户 id（从 100 开始，避免与真实用户冲突）
  const nameToId = {};
  let botId = 100;
  Array.from(names).forEach((name) => {
    const id = botId++;
    nameToId[name] = id;
    insertUser.run(id, name, botBios[name] || null, '2026-01-01 00:00:00');
  });

  const insertLetter = db.prepare(
    'INSERT INTO letters (id, sender_id, sender_name, title, content, stamp_type, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertReply = db.prepare(
    'INSERT INTO letter_replies (letter_id, author_id, author_name, content, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const insertPost = db.prepare(
    'INSERT INTO posts (id, author_id, author_name, content, base_likes, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const insertPostResp = db.prepare(
    'INSERT INTO post_responses (post_id, author_id, author_name, content, created_at) VALUES (?, ?, ?, ?, ?)'
  );

  letterData.forEach((l) => {
    insertLetter.run(l.id, nameToId[l.sender], l.sender, l.title, l.content, l.stamp, l.vis, l.date);
    l.replies.forEach((r) => {
      insertReply.run(l.id, nameToId[r[1]], r[1], r[0], r[2]);
    });
  });

  postData.forEach((p) => {
    insertPost.run(p.id, nameToId[p.author], p.author, p.content, p.likes, p.date);
    p.responses.forEach((r) => {
      insertPostResp.run(p.id, nameToId[r[1]], r[1], r[0], r[2]);
    });
  });

  console.log('种子完成：%d 个 bot 用户，%d 封信，%d 个帖子',
    names.size, letterData.length, postData.length);
}

seed();
