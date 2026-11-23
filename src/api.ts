1
2
3
4
5
6
7
8
9
10
11
12
13
14
16
17
18
19
20
21
22
23
24
25
26
27
28
29

:!.. LTE
694
Edit
Commit
const
api
•=｛
async get (path: string) {
return request (path, { method: 'GET' });
async post (path: string, body?: unknown) {
return request (path, method: 'POST',
headers: { 'Content-Type': 'application/json' }, body: JSON.stringify (body ?? {})
});
}
async function request(path: string, options: RequestI
const response = await fetch(path, options);
const data = await response.json().catch(() =>
•（｛））
if (!response.ok){
throw f
message: data. error response: { data }
'Request failed',
return { data };
export { api };
Expected branch to point to
8d687e618d89201a32e87480f4c84a8eb006
7dOat but it did not. Pull and try again.