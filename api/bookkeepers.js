import fetch from "node-fetch";

//Simple in-memory cache
const cache = new Map();

export default async function handler(req, res) {
    try{
        const {city, industry, page=1, limit=50} = req.query;

        //check cache key
        const cacheKey = "bookkeepers_all";
        const now = Date.now();
        const ttl = (process.env.CACH_TTL_SECONDS || 3600) * 1000; //default 1 hour

        let items = [];
        const cached = cache.get(cacheKey);

        //If cached and not expired, use it
        if(cached && (now - cached.timestamp < ttl)){
            items = cached.data;
        }else{
            //Otherwise fetch from Webflow API
            const collectionId = process.env.WEBFLOW_BOOKKEEPERS_COLLECTION_ID;
            const token = process.env.WEBFLOW_API_TOKEN;

            let offset = 0;
            let hasMore = true;
            const results = [];

            while(hasMore){
                const url = `https://api.webflow.com/collections/${collectionId}/items?limit=100&offset=${offset}`;
                const resApi = await fetch(url, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "accept-version": process.env.WEBFLOW_API_VERSION || "1.0.0",
                    }
                });

                const data = await resApi.json();
                if (!resApi.ok) throw new Error(data.msg || "Webflow API error");

                results.push(...data.items);
                if (data.items.length < 100) hasMore = false;
                offset += 100;
            }

            items = results.map(i=>i.fieldData);
            cache.set(cacheKey, { timestamp: now, data: items });
                console.log(`Fetched ${items.length} items from Webflow`);
            }
        
        //Apply filters
        let filtered = items;
        if (city) filtered = filtered.filter(i => i.city?.toLowerCase() === city.toLowerCase());
        if (industry) filtered = filtered.filter(i => i.industry?.toLowerCase() === industry.toLowerCase());

        // Pagination
        const start = (page - 1) * limit;
        const end = start + Number(limit);
        const paginated = filtered.slice(start, end);

        // Response
        res.status(200).json({
            total: filtered.length,
            page: Number(page),
            perPage: Number(limit),
            results: paginated,
        });
    }catch(error){
        console.error(err);
        res.status(500).json({ error: err.message });
    }
}