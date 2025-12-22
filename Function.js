const axios = require('axios');
const logger = require('./Module/logger');
const { json } = require('body-parser');
const config = require('./config.json');

let myExtension = null;
let myCallerId = null;

async function actionPost(url, body) {
    try {        
        logger(`[Axios.POST]:URL=${url},BODY=${JSON.stringify(body)}`);

        const thisResp =  {
            method: 'post',
            maxBodyLength: Infinity,
            url: url,
            headers: { 
                'Content-Type': 'application/json'
            },
            data : body
        };

        axios.request(thisResp)
            .then((response) => {
            logger(`[Axios.POST]:RESP=${JSON.stringify(response.data)}`);
        })
        .catch((error) => {

        });
    } catch (error) {
        logger(`[Axios.POST]:ERR=${error.message}`);
    }
}

async function actionGet(url, body) {
    try {
        logger(`[Axios.Get]:URL=${url},BODY=${JSON.stringify(body)}`);
        const response = await axios.get(url, body, {
        headers: {
            "Content-Type": "application/json"
        }
        });

        return response.data;  // hasil dikembalikan
    } catch (error) {
        logger(`Error.ActionGet:${error.message}`);
        return error; // lempar lagi kalau caller mau handle
    }
}

function getExtension(channel) {
    if (!channel) return null;

    // Ambil angka setelah slash "/" dan sebelum tanda "-" berikutnya
    const match = channel.match(/\/(\d+)-/);

    return match ? match[1] : null;
}

function postStatus(status, event){
    myExtension = null;
    myExtension = getExtension(event.Channel);

    myCallerId = '';
    if(status==='Connected'){
        myCallerId = event.ConnectedLineNum;
    }

    logger(`AXIOS.POST:Ext=${myExtension},State=${status},CallerId=${myCallerId}`)

    const postThis = async () => {
        const result = await actionPost(config.AXIOS.URL, {
            extension: myExtension,
            state: status,
            caller: myCallerId,
            interaction_id: ''
        });
    };

    postThis(); // load
}


module.exports={
    actionPost,
    actionGet, 
    postStatus,
    getExtension
}