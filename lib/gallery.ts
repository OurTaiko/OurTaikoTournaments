import type { StaticImageData } from "next/image";
import { HACHICATS_TOURNAMENT_ID, tournaments } from "@/lib/tournaments";
// Photos live in public/<series>/<edition>/; static imports give next/image
// their dimensions and blur placeholders. tests/gallery.test.mjs keeps the
// folder and this list in sync.
import hcStoreSign from "@/public/hachicats/20260927/DB333B14F709F73960A9CE30D59B99FF.jpg";
import hcPoster from "@/public/hachicats/20260927/C5234DEB4F60934767B321FCD103F29C.jpg";
import hcBadges from "@/public/hachicats/20260927/CB23C00F9EAD5B4D2B4CB37E21E33FA7.jpg";
import hcDrum from "@/public/hachicats/20260927/5467D6A14D8A203790AF237D3F3459AB.jpg";
import hcSticks from "@/public/hachicats/20260927/66FB238613655A980E17F6E611155533.jpg";
import hcPlayer from "@/public/hachicats/20260927/F7647375C6453F522B9970C87CEB9168.jpg";
import hcCabinet from "@/public/hachicats/20260927/F4127C06DCA16196441F05AA97D280A1.jpg";
import hcBroadcast from "@/public/hachicats/20260927/E0C504EFCE82EADF9AF36E8481735E5E.jpg";
import hcWinners from "@/public/hachicats/20260927/D351BD6B629B456C5FA6265D16FCF5DA.jpg";
import hcPrizes from "@/public/hachicats/20260927/0B883B1158B7A9E7EC67897A178D445A.jpg";
import hcPodium from "@/public/hachicats/20260927/A44D4627CBD432D65DB14E886B63D5AC.jpg";
import hcBanner from "@/public/hachicats/20260927/C3F6869A6B8EBC3AE3923910B0BE304C.jpg";
import hcGroup from "@/public/hachicats/20260927/4341D3689F9AE411BFA180DCDA68B204.jpg";
import hcSeated from "@/public/hachicats/20260927/D16C2583ED2CF910EAFB190AAC352543.jpg";
import hcGreeting from "@/public/hachicats/20260927/4080D3678370252581C25AFE163D0296.jpg";
import hcCosplay from "@/public/hachicats/20260927/69713AFB855D886B35299317D1A5E40C.jpg";
import hcBooth from "@/public/hachicats/20260927/B3937AD648AD40A9404AE65DB1D60F9B.jpg";
import hcSigning from "@/public/hachicats/20260927/A27FC33144A201D521760A89102BDC61.jpg";
import hcDinner from "@/public/hachicats/20260927/F60E6664DECE82EEC103FBDA92DF2A32.jpg";

export type GalleryPhoto = { id: string; image: StaticImageData; alt: string; caption?: string };
export type GalleryChapter = { id: string; title: string; en: string; description: string; photos: GalleryPhoto[] };
export type TournamentGallery = {
  tournamentId: string;
  href: string;
  tournamentHref: string;
  name: string;
  series: string;
  date: string;
  displayDate: string;
  location: string;
  summary: string;
  cover: GalleryPhoto;
  chapters: GalleryChapter[];
};

const photo = (id: string, image: StaticImageData, alt: string, caption?: string): GalleryPhoto => ({ id, image, alt, caption });

const hachicatsCover = photo("group", hcGroup, "八猫杯全体选手与工作人员在猫鼓旗舰店横幅前合影", "全体合影");
const hachicats = tournaments.find(event => event.id === HACHICATS_TOURNAMENT_ID)!;

export const galleries: TournamentGallery[] = [{
  tournamentId: hachicats.id,
  href: `${hachicats.href}/gallery`,
  tournamentHref: hachicats.href,
  name: hachicats.name,
  series: hachicats.series,
  date: hachicats.date,
  displayDate: hachicats.displayDate,
  location: "猫鼓旗舰店 · 上海",
  summary: "暹罗、狸花、布偶三组 48 位选手，在猫鼓旗舰店度过的一整天。",
  cover: hachicatsCover,
  chapters: [{
    id: "venue",
    title: "赛场",
    en: "The Venue",
    description: "猫鼓旗舰店的鼓台、易拉宝和限定徽章，为八猫杯准备就绪。",
    photos: [
      photo("store-sign", hcStoreSign, "猫鼓旗舰店的立体招牌", "猫鼓旗舰店"),
      photo("poster", hcPoster, "印有三只猫咪的八猫杯易拉宝", "八猫杯易拉宝"),
      photo("drum", hcDrum, "鼓台上的太鼓与鼓棒", "等待开赛的鼓台"),
      photo("badges", hcBadges, "三枚八猫杯猫咪徽章", "八猫杯纪念徽章"),
      photo("sticks", hcSticks, "选手握着鼓棒的特写", "握紧鼓棒"),
    ],
  }, {
    id: "matches",
    title: "对决",
    en: "The Matches",
    description: "两台机台并行，屏幕前每一个音符都关乎晋级。",
    photos: [
      photo("player", hcPlayer, "选手在机台前演奏，观众在旁举着手机记录", "全力以赴"),
      photo("cabinet", hcCabinet, "机台前鼓棒落下的瞬间", "机台前"),
      photo("broadcast", hcBroadcast, "直播画面上的比赛实况", "比赛直播"),
    ],
  }, {
    id: "awards",
    title: "颁奖",
    en: "The Podium",
    description: "各组获奖选手捧着奖品，留下这一天的高光。",
    photos: [
      photo("winners", hcWinners, "获奖选手在猫鼓旗舰店招牌下手持奖品合影", "获奖选手"),
      photo("prizes", hcPrizes, "四位获奖选手在店门口展示奖品", "奖品到手"),
      photo("podium", hcPodium, "获奖选手在横幅下手持奖品合影", "领奖时刻"),
      photo("banner", hcBanner, "获奖选手与观众在横幅前合影", "台下的掌声"),
    ],
  }, {
    id: "together",
    title: "相聚",
    en: "Together",
    description: "比赛之外，是签名、合影、互动，以及赛后的那顿饭。",
    photos: [
      photo("seated", hcSeated, "选手与观众前排就座的大合影", "大合影"),
      hachicatsCover,
      photo("greeting", hcGreeting, "参与者与猫咪 cosplayer 比心互动", "比心"),
      photo("cosplay", hcCosplay, "紫发猫耳 cosplayer 手持太鼓周边", "现场 cosplay"),
      photo("booth", hcBooth, "cosplayer 在桌边与小朋友互动", "与小选手互动"),
      photo("signing", hcSigning, "在红色八猫杯签名板上签名", "签名留念"),
      photo("dinner", hcDinner, "赛后聚餐，大家举起手机围成一圈", "赛后聚餐"),
    ],
  }],
}];

export function galleryPhotos(gallery: TournamentGallery) {
  return gallery.chapters.flatMap(chapter => chapter.photos);
}

export function findGallery(tournamentId: string) {
  const gallery = galleries.find(g => g.tournamentId === tournamentId);
  if (!gallery) throw new Error("Unknown gallery");
  return gallery;
}
