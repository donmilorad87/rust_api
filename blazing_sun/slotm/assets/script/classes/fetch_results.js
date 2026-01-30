export default class DrawLines{

constructor(){}

async postData(url = '', data = {}) {
  
  const response = await fetch(url, {
    method: 'POST', 
    mode: 'same-origin', 
    cache: 'no-cache', 
    credentials: 'same-origin', 
    headers: {
      'Content-Type': 'application/json'
    },
    redirect: 'follow',
    referrerPolicy: 'no-referrer',
    body: JSON.stringify(data)
  });
  return await response.json();
}

}

