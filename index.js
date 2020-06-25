const cheerio = require('cheerio');
const axios = require('axios');
const nconf = require('nconf');
const iconv = require('iconv-lite');

nconf.argv().env().file({ file: 'config.json' });

const sid = nconf.get('sid');
const userName = nconf.get('user_name');

console.log(`${userName} :: ${sid}`);

const network = axios.create({
    baseURL: 'https://spaces.im/',
    timeout: 10000,
    headers: {
        'Accept-Language': 'ru-BY,ru;q=0.9,en-US;q=0.8,en;q=0.7,ru-RU;q=0.6',
        'Connection': 'keep-alive',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0'
    },
});

network.interceptors.response.use(response => {
    const ctype = response.headers["content-type"];

    if (ctype.includes("charset=UTF-8")) {
        response.data = iconv.decode(response.data, 'UTF-8');
    }

    return response;
})

async function removeBlog(href, id) {
    const { data } = await network.get(href);
    const page = cheerio.load(data, { xmlMode: true });

    const result = page('noscript').find('div.oh').text().trim();
    console.log(`Remove ${id} result: ${result}`);

}

async function findRemoveLinkBlog(href) {
    const regex = /-(\d+)\//gm;
    const regexResult = regex.exec(href);

    if (regexResult < 1) {
        console.log(`ERR: wrong href (${href}`);
        return;
    }

    const blogId = regexResult[1];
    const URL_BLOGS_EDIT = `https://spaces.im/diary/delete/?id=${blogId}&sid=${sid}`;

    const { data } = await network.get(URL_BLOGS_EDIT)

    const page = cheerio.load(data);

    const result = page("a[href*='Sure=1']");
    const link = cheerio(result).attr('href');
    console.log(`Find remove link: ${link}`);

    return [link, blogId];
}

async function getPage(pageIndex = 156) {
    const URL_BLOGS_PAGE = `https://spaces.im/diary/view/user/${userName}/all/p${pageIndex}/?sid=${sid}`;

    const { data } = await network.get(URL_BLOGS_PAGE);
    const page = cheerio.load(data);
    const links = [];

    page('#main_content').find('.blog-item__title').each((index, element) => {
        const link = cheerio(element).attr('href');
        console.log(`Find blog: ${link}`);
        links.push(cheerio(element).attr('href'));
    });

    return links;
}

(async () => {
    const lastPage = nconf.get('last_page');

    for (let page = lastPage; page > 1; page--) {
        console.log(`Start for ${page} page...`)
        const links = await getPage(page);

        for (const link of links) {
            await new Promise(r => setTimeout(r, 1000));
            const result = await findRemoveLinkBlog(link);

            if (!result) {
                console.log('ERR: no result!');
                continue;
            }

            await removeBlog(result[0], result[1]);
        }
    }
})();
