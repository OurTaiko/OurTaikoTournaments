// Tailwind class lists for patterns shared by several pages and components.
// `mobile:` is ≤760px and `phone:` is ≤640px (custom variants in app/globals.css).
import { cn } from "@/lib/utils";

// Page shell
export const topbar = "bg-white border-b border-line";
export const topbarInner = "max-w-[1060px] h-[74px] m-auto flex items-center gap-[18px] px-10 mobile:px-5 mobile:h-16";
export const brand = "flex items-center gap-2.5 font-[650] text-[21px] tracking-[-0.6px] mobile:text-[19px]";
export const brandIcon = "flex text-primary";
export const edition = "text-[14px] font-[450] border-l border-[#dedee3] pl-3.5 ml-[5px] tracking-normal mobile:hidden";
export const localTag = "text-[12px] py-[3px] px-2 bg-[#f5f5f7] border border-line rounded-[6px] text-[#6e6e73] mobile:text-[10px]";
export const login = "ml-auto flex items-center gap-[7px] text-[14px] text-[#56565d] py-2.5 mobile:[&_span]:hidden";
export const container = "max-w-[1060px] m-auto px-10 mobile:px-5";
export const footer = "flex justify-between gap-[15px] pt-[27px] pb-[27px] mt-8 border-t border-line text-[#92929b] text-[11px] mobile:flex-col mobile:text-[10px] mobile:pb-[30px]";
export const footerBrand = "flex items-center gap-[7px]";

// Buttons
export const primaryButton = "inline-flex justify-center items-center gap-[9px] bg-primary text-white rounded-[999px] py-3 px-6 text-[14px] font-medium min-h-11 hover:bg-[#0077ed]";
export const secondaryButton = "inline-flex items-center justify-center gap-[7px] min-h-11 py-[11px] px-[17px] bg-[#f0f0f4] rounded-[999px] text-[13px] text-[#45454c] font-medium hover:bg-[#e7e7ed]";
export const textButton = "inline-flex items-center gap-1.5 py-2.5 min-h-11 text-primary text-[13px]";
export const galleryButton = "inline-flex items-center gap-[7px] mt-[18px] py-[9px] px-[18px] rounded-[999px] bg-[#1d1d1f] text-white text-[14px] font-medium hover:bg-black";
export const muted = "text-[12px]!";
// Paragraphs inside the CenturyLink admin panel.
export const adminText = "max-w-[430px] text-[#77777f] text-[14px]";

// Event header and navigation
export const eventHead = "flex items-center justify-between pt-11 pb-9 gap-6 mobile:py-[25px]";
export const eventKicker = "text-[11px] tracking-[1.4px] text-[#77777f] font-semibold mobile:hidden mobile:text-[9px] mobile:tracking-[1px]";
export const eventTitle = "text-[38px] mt-2 mb-[15px] tracking-[-1.5px] leading-[1.3] mobile:text-[30px] mobile:mt-0 mobile:mb-3";
export const editionNo = "font-[350] text-[#b4b4bc] text-[32px] ml-5 mobile:text-[25px] mobile:ml-[13px]";
export const eventDetails = "flex gap-5 text-[14px] text-[#6e6e73] mobile:flex-col mobile:gap-1.5 mobile:text-[12px]";
export const eventDetail = "flex gap-[7px] items-center";
export const eventFormat = "flex gap-7 pt-6 mobile:hidden";
export const eventFormatItem = "text-[24px] font-[550] tracking-[-1px]";
export const eventFormatLabel = "block text-[12px] text-[#74747b] font-normal tracking-normal mt-[3px]";
export const workspaceNav = "flex items-center justify-between border-b border-[#dedee3] pb-3.5 mobile:pb-3 mobile:flex-wrap mobile:gap-4";
export const workspaceTabs = "mobile:w-full";
export const mainTabs = "gap-7! h-9! p-0! mobile:w-full mobile:justify-between mobile:gap-1.5!";
export const mainTab = "py-1.5! px-0! border-0! text-[15px] leading-[calc(1.25/0.875)] text-[#66666c] data-[state=active]:text-primary! after:bg-primary! after:bottom-[-15px]! [&_svg]:mr-[5px] mobile:text-[14px]! mobile:shrink-0 mobile:after:bottom-[-13px]! mobile:[&_svg]:hidden";
export const syncLabel = "flex items-center gap-[7px] text-[12px] text-[#77777d] mobile:hidden mobile:text-[10px] mobile:gap-1";
export const syncDot = "h-[5px] w-[5px] rounded-[50%] bg-[#008b49]";
export const mobileRounds = "hidden! mobile:flex! mobile:mb-[18px]";
export const mobileRoundsList = "mobile:h-11! mobile:w-full mobile:rounded-[10px]";
export const mobileRoundsTab = "mobile:text-[12px] mobile:py-[9px] mobile:px-[7px]";

// Section headings
export const sectionHeading = "flex justify-between items-center mb-4 gap-[15px]";
export const sectionTitle = "text-[19px] flex items-center gap-2 mobile:text-[17px] [&_svg]:text-primary";
export const sectionNote = "text-[12px] text-[#77777f] mobile:text-[11px]";
export const count = "bg-[#e7effa] text-primary text-[12px] py-px px-[7px] rounded-[6px] ml-1";
export const dot = "inline-block w-[5px] h-[5px] rounded-[50%] bg-current";

// Bracket match cards
export const bracketSection = "mt-[34px] mobile:mt-7";
export const roundTitle = "flex items-center justify-between text-[#6e6e73] text-[13px] mb-3.5";
export const roundTitleNote = "text-[#9999a1] text-[11px]";
export const matchSlot = "min-w-0";
export const matchCard = "relative block w-full bg-white border border-[#e4e4e9] rounded-[12px] py-[11px] px-3 text-left min-h-[99px] shadow-[0_2px_7px_#00000002] hover:border-[#b4b4bf] mobile:min-h-[113px] mobile:py-[13px] mobile:px-4 mobile:rounded-[14px]";
export const matchLive = "border-[#7facdf] bg-[#fbfdff]";
export const matchConnector = "after:content-[''] after:absolute after:right-[-24px] after:top-1/2 after:w-[23px] after:border-t after:border-[#cfcfd8] mobile:after:hidden";
export const matchMeta = "flex justify-between items-center text-[10px] text-[#8a8a93] mb-2 gap-1 mobile:text-[11px] mobile:mb-2.5";
export const matchStatus = "flex gap-1 items-center";
export const player = "flex items-center gap-1.5 text-[13px] min-h-9 leading-[1.25] mobile:min-h-7 mobile:text-[15px]";
export const seed = "text-[10px] text-[#9b9ba2] w-3.5 tabular-nums mobile:text-[11px] mobile:w-5";
export const playerProfile = "flex flex-col gap-[3px] flex-1 min-w-0 py-[3px]";
export const playerName = "overflow-hidden whitespace-nowrap text-ellipsis flex-1";
export const winnerText = "text-primary font-semibold";
export const score = "text-[11px] text-[#8d8d95] tabular-nums shrink-0 mobile:text-[14px]";
export const bracketLegend = "flex gap-[18px] my-5 text-[11px] text-[#7a7a82] mobile:text-[10px] mobile:flex-wrap mobile:gap-2.5";
export const legendItem = "flex items-center gap-1.5";
export const legendNote = "flex items-center gap-1.5 ml-auto mobile:ml-0 mobile:basis-full";
export const emptyLive = "flex flex-col gap-2.5 items-center justify-center bg-white rounded-[16px] text-[#75757d] min-h-[180px] text-[14px] p-[22px] text-center";

// Song lists and rules
export const songNote = "text-[#747b87] text-[12px] mb-[18px]";
export const songList = "bg-white rounded-[18px] px-6 mobile:px-4";
export const songRow = "flex gap-[18px] items-center py-5 border-b border-[#eeeef2] last:border-b-0 mobile:gap-2.5 mobile:py-[19px]";
export const songIndex = "text-[12px] text-[#9999a2] w-[22px] mobile:text-[11px] mobile:w-4";
export const songIcon = "text-[#93939c] mobile:hidden";
export const songTitle = "flex-1 font-medium wrap-anywhere mobile:text-[14px]";
export const songTag = "ml-2.5 text-[11px] text-[#6e6e73] bg-[#f0f0f4] py-1 px-1.5 rounded-[4px] mobile:text-[10px] mobile:inline-block";
export const stars = "text-primary text-[14px] font-semibold whitespace-nowrap mobile:text-[12px]";
export const designated = "py-[27px] flex gap-[18px] items-center text-[#777780]";
export const designatedTitle = "text-[15px] text-[#44444b] mb-1";
export const designatedText = "text-[13px]";
export const rules = "py-3";
export const rulesTitle = "text-[30px] mb-2.5 mobile:text-[25px]";
export const rulesLede = "text-[#6e6e73] text-[15px] mobile:text-[14px]";
export const ruleGrid = "grid grid-cols-2 gap-5 mt-7 mobile:grid-cols-[1fr] mobile:gap-3.5";
export const ruleCard = "p-[30px] bg-white rounded-[16px] mobile:p-6";
export const ruleNo = "text-[12px] text-primary";
export const ruleTitle = "text-[20px] mt-[15px] mb-2.5";
export const ruleText = "text-[#6e6e73] text-[14px] leading-[1.9]";
export const ruleLink = "text-primary flex gap-1 items-center text-[14px] mt-3";

// Match detail sheet
export const matchSheet = "w-[560px]! max-w-[560px]! gap-0! bg-white! mobile:w-screen! mobile:max-w-[100vw]!";
export const sheetHeader = "pt-7! px-[26px]! pb-[22px]! border-b border-[#eeeef2]";
export const sheetTitle = "text-[19px]";
export const sheetDescription = "text-[13px] leading-[calc(1.25/0.875)]";
export const sheetBody = "overflow-auto pt-[25px] px-[25px] pb-[calc(25px+env(safe-area-inset-bottom))] flex-1 mobile:pt-5 mobile:px-[18px] mobile:pb-10";
export const contestants = "grid grid-cols-[minmax(0,1fr)_28px_minmax(0,1fr)] items-center gap-2 text-center";
export const contestantName = "mb-[5px] text-[20px] wrap-anywhere";
export const contestantsVs = "col-start-2 row-start-1 text-[11px] text-[#747b87]";
export const ratingSource = "mt-3 mb-6 text-[#747b87] text-[11px] text-center";
export const playerRating = "block text-[#626975] text-[11px] font-medium leading-[1.4] whitespace-nowrap tabular-nums";

// Read-only match records
export const resultBox = "bg-accent text-primary rounded-[14px] p-7 text-center [&>svg]:mx-auto [&>svg]:mb-3";
export const resultTitle = "text-[22px]";
export const resultText = "text-[13px] mt-2";
export const summaryHeading = "text-[16px] font-semibold mb-3";
export const summarySection = "mt-6";
export const selectionRecord = "mt-3 p-3.5 border border-[#e4e4e9] rounded-[12px] text-[13px] wrap-anywhere";
export const selectionName = "font-semibold mb-2";
export const selectionItem = "flex items-baseline justify-between gap-2 my-1.5";
export const selectionBanned = "text-[#a23a3a] whitespace-nowrap";
export const selectionNote = "text-[#6e6e73] mt-2";
export const scoreTable = "w-full table-fixed border-collapse text-[12px]";
export const scoreCell = "py-3 px-1 border-b border-[#e4e4e9] text-right wrap-anywhere tabular-nums";
export const scoreSongCell = cn(scoreCell, "text-left! w-[42%]");
export const scoreCellNote = "block text-[#6e6e73] font-normal mb-[5px]";
export const scoreTotals = "font-semibold text-primary";

// Score editors
export const editor = "border-0 p-0 m-0 min-w-0 [&:disabled_button]:opacity-50 [&:disabled_button]:cursor-not-allowed";
export const privateNote = "flex items-center gap-[7px] text-[12px] text-[#6e6e73] bg-[#f5f5f7] p-3 rounded-[9px] mb-7";
export const formHeading = "flex items-center justify-between mt-6 mb-4";
export const formHeadingTitle = "text-[#9b9ba5] text-[13px]";
export const formHeadingName = "text-[#1d1d1f] text-[17px] ml-2";
export const formHeadingNote = "text-[11px] text-[#888890]";
export const pickSides = "grid grid-cols-2 gap-[18px] mobile:gap-3";
export const pickSide = "min-w-0";
export const pickSideName = "mb-[15px] text-[15px] font-semibold wrap-anywhere";
export const pickerLabel = "flex flex-col gap-[7px] mb-[13px] min-w-0 [&>[data-slot=native-select-wrapper]]:w-full [&>[data-slot=native-select-wrapper]]:min-w-0";
export const pickerLabelText = "text-[12px] text-[#74747d]";
export const songPicker = "block w-full! bg-[#f5f5f7]! border-0! shadow-none! rounded-[10px]! min-h-11! text-[13px]! whitespace-nowrap! text-left! pr-9 overflow-hidden text-ellipsis mobile:text-[12px]!";
export const editorInline = "flex gap-4 items-end mt-2.5 [&>label]:flex-1 [&>label]:m-0";
export const editorInlineButton = "mobile:text-[12px] mobile:p-3";
export const formHelp = "text-[13px] text-[#74747d] leading-[1.8] my-3.5";
export const scoreGrid = "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2.5 items-center";
export const scoreColumnHead = cn(scoreGrid, "text-[11px] text-[#85858f] mb-2.5 [&>span:not(:first-child)]:text-right [&>span:not(:first-child)]:overflow-hidden [&>span:not(:first-child)]:text-ellipsis");
export const scoreInputRow = cn(scoreGrid, "py-[13px] border-t border-[#eeeef2]");
export const scoreSong = "flex flex-col gap-[3px] text-[13px] wrap-anywhere";
export const scoreSongNote = "text-[10px] text-[#93939e]";
export const scoreInput = "bg-[#f5f5f7] border border-[#e7e7ed] rounded-[9px] min-w-0 w-full text-[15px] min-h-11 py-2.5 px-[7px] text-right tabular-nums placeholder:text-[12px] [&::-webkit-inner-spin-button]:hidden mobile:text-[16px]";
export const totalRow = cn(scoreGrid, "border-t border-[#dedee5] pt-[17px] pb-3 text-[13px]");
export const totalValue = "text-right text-primary text-[16px] tabular-nums mobile:text-[15px]";
export const editorActions = "grid grid-cols-2 gap-3 my-6 [&_button]:py-3 [&_button]:px-3.5";
export const byeArea = "mt-7 pt-[22px] border-t border-[#e5e5eb]";
export const byeTitle = "text-[15px]";
export const byeText = "text-[12px] text-[#85858e] mt-2 mb-[17px]";
export const formError = "p-3.5 bg-[#fff0ef] text-[#b0352c] rounded-[10px] text-[13px] sticky bottom-0";

// Roster management
export const playerManager = "w-full mt-7 text-left [&_button:disabled]:opacity-50 [&_button:disabled]:cursor-not-allowed";
export const playerManagerHeading = cn(sectionHeading, "flex-wrap gap-3 phone:items-start");
export const playerEditForm = "my-4 p-4 border border-[#e4e4e9] rounded-[8px] grid gap-3";
export const playerEditLabel = "grid gap-1.5 text-[13px]";
export const playerEditInput = "w-full border border-[#e4e4e9] p-2.5 rounded-[6px] phone:text-[16px]";
export const playerFormActions = "flex gap-2.5";
export const rosterList = "grid grid-cols-2 gap-2 phone:grid-cols-1";
export const rosterRow = "flex gap-2.5 items-center p-2.5 border border-[#e4e4e9] rounded-[8px] min-w-0";
export const rosterProfile = cn(playerProfile, "wrap-anywhere");

// Gallery pages (dark palette: `g-*` colors in app/globals.css)
export const galleryPage = "min-h-screen bg-g-bg text-g-text [color-scheme:dark] [&_:is(a,button):focus-visible]:[outline:3px_solid_#2997ff90]";
export const galleryWrap = "max-w-[1200px] mx-auto px-10 mobile:px-4";
export const galleryKicker = "text-g-muted text-[12px] font-semibold tracking-[0.14em] uppercase";
export const galleryLede = "max-w-[56ch] text-g-soft text-[18px] leading-[1.75] mobile:text-[16px]";
export const galleryMeta = "flex flex-wrap gap-y-2 gap-x-[22px] text-g-soft text-[14px]";
export const galleryMetaItem = "inline-flex items-center gap-[7px]";
export const galleryPill = "inline-flex items-center gap-1.5 py-[11px] px-[22px] rounded-[999px] bg-g-text text-black text-[14px] font-[550] hover:bg-white";
export const galleryPillGhost = "bg-[rgb(255_255_255/12%)] text-g-text backdrop-blur-[16px] hover:bg-[rgb(255_255_255/20%)]";
export const galleryFooter = "flex justify-between gap-5 mt-16 pt-8 pb-10 border-t border-[rgb(255_255_255/10%)] text-g-muted text-[12px] mobile:flex-col";
