var gloginPageBgUrl = 'login_bg.jpg'; // 请修改为登录界面背景文件名
var gloginLogo = 'login_icon_logo.png'; //请修改为网页logo文件名
var gmainLogo = 'nav_icon_head.png'; //请修改为网页logo文件名
var gcustomeexperience = 'demo';
var gdefaultLanguage = 'auto'; // zh en auto
var gdefaultLatLon = { lat: 30.54408, lon: -7.523766 }; // map center
var glogin_input_backgroud_color = '#ffffff';
var glogin_input_font_color = '#999999';
var glogin_input_font_select_color = '#000000';
var glogin_page_font_color = '#ffffff';
var gShowAppQRCode = true;
var gShowWxQRCode = true;
var gShowVersion = true;
var gShowRegister = false;
var gShowDemo = true;
var gShowSelectLanguage = true;
var gShowBeiAn = true;
var gMarkerWidth = 32;
var gdeploylicenseid = '12345678901234567890123456789012';
window.loginPage = 'DefaultLogin'; // 自定义登录页面 DefaultLogin CustomLogin
//  中文简体
var customZh = {
    // login: {
    //     title: '请修改中文标题',
    //     shorttitle: '请修改监控界面标题',
    //     beiAn1: '编辑中文备案1的信息',
    //     beiAn2: '编辑中文备案2的信息',
    // }
};
// 英文
var customEn = {
    // login: {
    //     title: 'please edit title in English',
    //     shorttitle: 'please edit monitor page title in English',
    //     beiAn1: 'Edit beian1 hint in English',
    //     beiAn2: 'Edit beian2 hint in English',
    // }
};
// 法语
var customFr = {
    // login: {
    //     title: 'please edit title in English ',
    //     shorttitle: 'please edit monitor page title in English',
    //     beiAn1: 'Edit beian1 hint in English ',
    //     beiAn2: 'Edit beian2 hint in English ',
    // }
};
// 西班牙
var customEs = {
    // login: {
    //     title: 'please edit title in English ',
    //     shorttitle: 'please edit monitor page title in English',
    //     beiAn1: 'Edit beian1 hint in English ',
    //     beiAn2: 'Edit beian2 hint in English ',
    // }
};
// 葡萄牙语
var customPt = {
    // login: {
    //     title: 'please edit title in English ',
    //     shorttitle: 'please edit monitor page title in English',
    //     beiAn1: 'Edit beian1 hint in English ',
    //     beiAn2: 'Edit beian2 hint in English ',
    // }
};
//  俄罗斯语
var customRu = {
    // login: {
    //     title: 'please edit title in English ',
    //     shorttitle: 'please edit monitor page title in English',
    //     beiAn1: 'Edit beian1 hint in English ',
    //     beiAn2: 'Edit beian2 hint in English ',
    // }
};
// 印度尼西亚
var customId = {
    // login: {
    //     title: 'please edit title in English ',
    //     shorttitle: 'please edit monitor page title in English',
    //     beiAn1: 'Edit beian1 hint in English ',
    //     beiAn2: 'Edit beian2 hint in English ',
    // }
};
// 中文繁体
var customTw = {
    // login: {
    //     title: 'please edit title in English ',
    //     shorttitle: 'please edit monitor page title in English',
    //     beiAn1: 'Edit beian1 hint in English ',
    //     beiAn2: 'Edit beian2 hint in English ',
    // }
};
//  土耳其
var customTr = {
    // login: {
    //     title: 'please edit title in English ',
    //     shorttitle: 'please edit monitor page title in English',
    //     beiAn1: 'Edit beian1 hint in English ',
    //     beiAn2: 'Edit beian2 hint in English ',
    // }
};

// 伊朗 波斯语
var customFa = {
    // login: {
    //     title: 'please edit title in English ',
    //     shorttitle: 'please edit monitor page title in English',
    //     beiAn1: 'Edit beian1 hint in English ',
    //     beiAn2: 'Edit beian2 hint in English ',
    // }
};

// 日语
var customJa = {
    // login: {
    //     title: '日本语言',
    //     shorttitle: 'please edit monitor page title in English',
    //     beiAn1: 'Edit beian1 hint in English ',
    //     beiAn2: 'Edit beian2 hint in English '
    // }
};

// 越南语
var customVi = {
    // login: {
    //     title: '越南语',
    //     shorttitle: 'please edit monitor page title in English',
    //     beiAn1: 'Edit beian1 hint in English ',
    //     beiAn2: 'Edit beian2 hint in English ',
    // }
};

// 阿拉伯
var customAr = {
    // login: {
    //     title: '越南语',
    //     shorttitle: 'please edit monitor page title in English',
    //     beiAn1: 'Edit beian1 hint in English ',
    //     beiAn2: 'Edit beian2 hint in English ',
    // }
};

// 格鲁吉亚语
var customGe = {
    // login: {
    //     title: '越南语',
    //     shorttitle: 'please edit monitor page title in English',
    //     beiAn1: 'Edit beian1 hint in English ',
    //     beiAn2: 'Edit beian2 hint in English ',
    // }
};

// 乌克兰
var customUa = {
    // login: {
    //     title: '',
    //     shorttitle: 'please edit monitor page title in English',
    //     beiAn1: 'Edit beian1 hint in English ',
    //     beiAn2: 'Edit beian2 hint in English '
    // }
};

// 阿塞拜疆
var customAz = {
    // login: {
    //     title: '',
    //     shorttitle: 'please edit monitor page title in English',
    //     beiAn1: 'Edit beian1 hint in English ',
    //     beiAn2: 'Edit beian2 hint in English ',
    // }
};

window.gloginPageBgUrl = gloginPageBgUrl;
window.gloginLogo = gloginLogo;
window.gmainLogo = gmainLogo;
window.gcustomeexperience = gcustomeexperience;
window.gdefaultLatLon = gdefaultLatLon;
window.gdefaultLanguage = gdefaultLanguage;
window.gShowAppQRCode = gShowAppQRCode;
window.glogin_input_backgroud_color = glogin_input_backgroud_color;
window.glogin_input_font_select_color = glogin_input_font_select_color;
window.glogin_input_font_color = glogin_input_font_color;
window.glogin_page_font_color = glogin_page_font_color;
window.gShowVersion = gShowVersion;
window.gShowDemo = gShowDemo;
window.gShowSelectLanguage = gShowSelectLanguage;
window.gMarkerWidth = gMarkerWidth;
window.gShowBeiAn = gShowBeiAn;
window.gMarkerWindowDy = -(gMarkerWidth / 2);
