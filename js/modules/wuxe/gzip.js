// gzip 解压工具函数
export async function fetchGzip(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // 检查是否支持压缩流API
    if (typeof DecompressionStream !== 'undefined') {
        const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
        const reader = stream.getReader();
        const chunks = [];
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
        }
        
        // 合并所有 chunks
        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        
        // 解析 JSON
        const decoder = new TextDecoder('utf-8');
        return JSON.parse(decoder.decode(result));
    } else {
        // 降级方案：直接返回 response（服务器可能没有压缩）
        return response.json();
    }
}
