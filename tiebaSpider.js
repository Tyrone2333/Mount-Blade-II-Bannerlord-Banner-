/**
 *
 * @type {*}
 */
import {
    downloadByBannerCode
} from './puppeteer'

const md5 = require('md5')

//依赖模块
const fs = require('fs')
const path = require('path')
const request = require('request')
const cheerio = require('cheerio')
const mkdirp = require('mkdirp')
const async = require('async')
const puppeteer = require('puppeteer-core')

// 本地存储目录
export const saveDir = 'screenshot'

;(async function() {
    // 先获取到已存在的图片列表
    let savedBannerList = []

    let files = fs.readdirSync(saveDir)
    files.forEach((item, index) => {
        savedBannerList.push(item.replace(/.png/, ''))
    })

    let browser
    let page
    browser = await puppeteer.launch({

        executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        // executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        args: ['--no-sandbox'],
        dumpio: false,
        // headless: false,
    })

    page = await browser.newPage()

    console.log('正在打开 https://bannerlord.party/banner/, 如果 30s 还没打开就会超时')

    try {
        await page.goto('https://bannerlord.party/banner/')
    } catch (e) {
        console.log('网站加载超时,请重新运行任务')

        process.exit(-1)
    }

    console.log('网站加载成功')

    // 创建目录
    mkdirp(saveDir, err => {
        if (err) {
            console.log(err)
        } else {
            console.log(`${ saveDir }文件夹创建成功!准备下载`)
        }
    })

    // 下载方法
    let download = function(url, dir, filename) {
        request.head(url, (err, res, body) => {
            request(url).on('error', err => {
                console.log(err)
            })
                .pipe(fs.createWriteStream(`${ dir }/${ filename }`))
        })
    }

    async function requestMore(url, index) {
        // 图片链接地址
        let links = []

        // 旗帜代码数组
        let bannerCodeList = []

        let postAll = []

        let saveFileString = ''

        // 发送请求
        request(url, async(error, response, body) => {
            if (!error && response.statusCode === 200) {
                // 仅用来统计有匹配到多少个代码
                let codeList = []
                let $ = cheerio.load(body)
                let $postList = $('.d_post_content.j_d_post_content')
                // todo 回复中的内容是异步加载,第一次获取不到,后面再用 puppeteer 模拟吧
                let $replyList = $('.lzl_single_post.j_lzl_s_p')

                // 至少5次才认为是旗帜代码, `.`的后面还要是数字,把前面的部分复制一下
                let reg = /((-)?(\d+)(\.)){5,}(-)?(\d+)/g
                $postList.each(function(index) {
                    // todo 有的帖子 text 出来是空,暂时不知道是为什么
                    let textContent = $(this).text()
                    postAll.push(textContent)

                    // console.log(index + ' textContent ===> ', textContent)
                    let codes = textContent.match(reg) || []
                    for (let item of codes) {
                        codeList.push(item)

                        let md5FileName = md5(item)
                        // 已存在就不 push
                        savedBannerList.indexOf(md5FileName) === -1 && bannerCodeList.indexOf(md5FileName) === -1 && bannerCodeList.push(item)
                    }
                })

                console.log(`第${ index }页,旗帜代码共有 ${ codeList.length },所有页面过滤后有代码 ${ bannerCodeList.length } 个,回复列表共用 ${ $postList.length } `)

                let list = [1, 2, 3, 4, 5, 6, 7, 8]
                // 一次开5个下载图片
                async.mapLimit(bannerCodeList, 5, (item, callback) => {
                    // async.mapLimit(list, 5, function (item, callback) {

                    // return
                    downloadByBannerCode(browser, item).then(res => {
                        console.log('成功了', res)

                        saveFileString
                            += `
![](${ res })
\`\`\`
${ item }
\`\`\`

`
                    })
                        .catch(res => {
                            console.log('生成图片出错', res)
                        })
                        .finally(async() => {
                        // await browser.close()
                            callback()
                        })
                }, (err, results) => {
                    // 写入文件内容（如果文件不存在会创建一个文件）
                    // 传递了追加参数 { 'flag': 'a' }
                    // `\n\n ${new Date()} \n --- 第 ${index} 页` +
                    fs.writeFile('./try4.md', saveFileString, {
                        flag: 'w',
                    }, err => {
                        if (err) {
                            throw err
                        }

                        console.log('文件写入完成')
                    })

                    // console.log(`第${index}页全部爬完。`)
                    console.log(`第${ index }页全部爬完 ----------------------------------- bannerCodeList 共有${ bannerCodeList.length } `)
                })
            } else {
                console.log('请求出错: ', error)
            }
        })
    }

    // 不要太大,内存爆炸.5个为宜
    for (let i = 16; i <= 16; i ++) {
        // 目标网址
        requestMore(`https://tieba.baidu.com/p/6599233099?pn=${ i }`, i)
    }
}())
