exports.handler = async function(event, context) {
    var url = event.queryStringParameters ? event.queryStringParameters.url : null;
    if (!url) {
        return { statusCode: 400, body: 'Missing url parameter' };
    }

    try {
        var response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            return { statusCode: response.status, body: 'Upstream fetch failed: ' + response.status };
        }

        var arrayBuffer = await response.arrayBuffer();
        var buffer = Buffer.from(arrayBuffer);
        var base64 = buffer.toString('base64');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
                'Access-Control-Allow-Origin': '*',
                'Content-Disposition': 'attachment',
                'Content-Length': buffer.length.toString()
            },
            body: base64,
            isBase64Encoded: true
        };
    } catch (error) {
        return { statusCode: 500, body: 'Proxy error: ' + error.message };
    }
};