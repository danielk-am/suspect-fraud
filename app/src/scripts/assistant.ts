// Session-scoped OpenRouter BYOK. No case context is attached automatically.
import {shortcutLabels} from './keyboard-shortcuts.mjs';
const panel = document.querySelector<HTMLElement>('#af-assistant');
if (panel) {
  const platform = (navigator as Navigator & {userAgentData?: {platform?: string}}).userAgentData?.platform || navigator.platform;
  const shortcuts = shortcutLabels(platform);
  panel.querySelector<HTMLElement>('[data-af-send-modifier]')!.textContent = shortcuts.modifier;
  panel.querySelector<HTMLElement>('[data-af-shift-key]')!.textContent = shortcuts.shift;
  panel.querySelector<HTMLElement>('[data-af-shortcut="send"]')!.setAttribute('aria-label', shortcuts.send);
  panel.querySelector<HTMLElement>('[data-af-shortcut="newline"]')!.setAttribute('aria-label', shortcuts.newline);
  const options = panel.querySelector<HTMLElement>('#af-assistant-options')!;
  const toggles = [...panel.querySelectorAll<HTMLButtonElement>('[data-af-options-toggle]')];
  const prompt = panel.querySelector<HTMLTextAreaElement>('#af-prompt')!;
  const status = panel.querySelector<HTMLElement>('#af-chat-status')!;
  const providerStatus = panel.querySelector<HTMLElement>('#af-provider-status')!;
  const keyInput = panel.querySelector<HTMLInputElement>('#af-api-key')!;
  const consent = panel.querySelector<HTMLInputElement>('#af-cloud-consent')!;
  const connectForm = panel.querySelector<HTMLFormElement>('#af-connect')!;
  const connectButton = panel.querySelector<HTMLButtonElement>('#af-connect-button')!;
  const disconnectButton = panel.querySelector<HTMLButtonElement>('#af-disconnect')!;
  const sendButton = panel.querySelector<HTMLButtonElement>('[data-af-composer] button[type=submit]')!;
  const providerLabel = panel.querySelector<HTMLElement>('[data-af-provider-label]')!;
  const messages = panel.querySelector<HTMLElement>('[data-af-messages]')!;
  let ready = false, authenticated = false, connecting = false;
  let generation = 0;
  let active: AbortController | null = null;
  let conversation: {role: 'user' | 'assistant'; content: string}[] = [];
  prompt.maxLength = 4000;
  function sync() {
    sendButton.disabled = !active && (!ready || !prompt.value.trim());
    sendButton.textContent = active ? 'Stop' : 'Send';
    sendButton.title = active ? 'Stop this request' : ready ? 'Send recent chat to OpenRouter' : 'Connect OpenRouter in Assistant options';
    sendButton.setAttribute('aria-label',active ? 'Stop request' : 'Send message');
    keyInput.disabled = !authenticated || connecting;
    consent.disabled = !authenticated || connecting;
    connectButton.disabled = !authenticated || connecting;
    panel!.querySelector<HTMLButtonElement>('[data-af-new-chat]')!.disabled=connecting;
    connectForm.hidden = ready;
    disconnectButton.hidden = !ready;
    panel!.querySelector<HTMLElement>('#af-unlock-link')!.hidden = authenticated;
    providerLabel.textContent = ready ? 'OpenRouter · free' : 'Connect OpenRouter';
    providerStatus.textContent = !authenticated ? 'Unlock the workspace before connecting your key.' : ready ? 'Connected · openrouter/free · recent chat only.' : connecting ? 'Validating key with OpenRouter…' : 'Connect your key below. No paid fallback.';
  }
  async function request(path: string, method = 'GET', body?: unknown, signal?: AbortSignal) {
    const version = generation;
    const response = await fetch(path,{method,credentials:'same-origin',signal,headers:body===undefined?{}:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const data = await response.json();
    if(!response.ok) {
      if(version===generation){
        if(data.error?.code==='unauthenticated'||data.error?.code==='browser_session_required'){authenticated=false;ready=false;document.dispatchEvent(new Event('sf:session-expired'));}
        if(['assistant_disconnected','assistant_key'].includes(data.error?.code))ready=false;
      }
      throw new Error(data.error?.message || 'The assistant request failed. Your draft is preserved.');
    }
    return data;
  }
  async function refresh() {
    const version=++generation;
    try{const data=await request('/api/assistant');if(version!==generation)return;authenticated=true;ready=data.connected;if(ready&&!conversation.length)status.textContent='Connected. Only messages you send here go to OpenRouter. No case files are attached.';}
    catch{if(version!==generation)return;authenticated=false;ready=false;}
    sync();
  }
  function stop() {active?.abort();}
  document.addEventListener('sf:auth', event => {
    if(!(event as CustomEvent).detail){generation++;stop();authenticated=false;ready=false;keyInput.value='';consent.checked=false;prompt.value='';conversation=[];messages.replaceChildren();panel!.querySelector<HTMLElement>('[data-af-welcome]')!.hidden=false;status.textContent='Workspace locked. Chat history cleared.';sync();}
    else void refresh();
  });
  connectForm.addEventListener('submit',async event=>{
    event.preventDefault();if(connecting||!authenticated)return;
    connecting=true;generation++;const version=generation;
    const key=keyInput.value.trim();keyInput.value='';sync();
    const controller=new AbortController();active=controller;sync();
    try{await request('/api/assistant','POST',{key,consent:consent.checked},controller.signal);if(version!==generation)return;ready=true;status.textContent='Connected. Your recent chat will go to OpenRouter and a free-model provider. Case files stay separate.';closeOptions();prompt.focus();}
    catch(e){if(version===generation){
      if(controller.signal.aborted){
        try{await request('/api/assistant','DELETE');if(version===generation)status.textContent='Connection stopped. The server has forgotten your key.';}
        catch{if(version===generation)status.textContent='Connection stopped. Could not confirm key removal; lock the workspace to clear it.';}
      }else status.textContent=e instanceof Error?e.message:'Connection failed.';
    }}
    finally{if(active===controller){active=null;connecting=false;}sync();}
  });
  disconnectButton.addEventListener('click',async()=>{
    stop();generation++;ready=false;keyInput.value='';consent.checked=false;sync();
    try{await request('/api/assistant','DELETE');status.textContent='Disconnected. The server has forgotten your key.';}
    catch(e){status.textContent=e instanceof Error?e.message:'Could not confirm disconnection. Lock the workspace to clear the key.';}
    sync();
  });
  const append=(role:string,text:string)=>{const article=document.createElement('article');article.className='af-chat-message';const heading=document.createElement('strong');heading.textContent=role;const content=document.createElement('p');content.textContent=text;article.append(heading,content);messages.append(article);article.scrollIntoView({block:'nearest'});};
  async function send() {
    if(active){stop();return;}
    if(!ready){status.textContent='Connect your OpenRouter key in Assistant options first. Your draft is preserved.';return;}
    const content=prompt.value.trim();if(!content)return;
    let recent=[...conversation,{role:'user' as const,content}];
    while(recent.length>11||recent.reduce((n,m)=>n+m.content.length,0)>24000)recent.splice(0,2);
    const controller=new AbortController();active=controller;const version=generation;sync();
    status.textContent='Waiting for a free model… up to 30 seconds. Stop cancels this request.';
    try{
      const result=await request('/api/assistant/chat','POST',{messages:recent},controller.signal);
      if(version!==generation)return;
      append('You',content);append('Assistant',result.text);conversation=[...recent,{role:'assistant',content:result.text}];
      panel!.querySelector<HTMLElement>('[data-af-welcome]')!.hidden=true;
      if(prompt.value.trim()===content)prompt.value='';
      status.textContent='Answered by '+result.model+'. Check factual claims independently. No app changes or reports were made.';
    }catch(e){if(version===generation)status.textContent=controller.signal.aborted?'Stopped. Your draft is preserved. The request may already have reached OpenRouter.':e instanceof Error?e.message:'Assistant unavailable. Your draft is preserved.';}
    finally{if(active===controller)active=null;sync();}
  }
  prompt.addEventListener('input',sync);
  void refresh();
  let opener: HTMLButtonElement | null = null;
  const closeOptions = (restore = false) => {
    options.hidden = true;
    toggles.forEach(button => button.setAttribute('aria-expanded', 'false'));
    if (restore) opener?.focus();
  };
  toggles.forEach(button => button.addEventListener('click', () => {
    if (!options.hidden) {closeOptions(true); return}
    opener = button;
    options.hidden = false;
    toggles.forEach(toggle => toggle.setAttribute('aria-expanded', 'true'));
    options.querySelector<HTMLElement>('.af-select-trigger, select:not([hidden])')?.focus();
  }));
  panel.querySelector('[data-af-options-close]')?.addEventListener('click', () => closeOptions(true));
  document.addEventListener('click', event => {
    const target = event.target as Node;
    if (!options.hidden && !options.contains(target) && !toggles.some(toggle => toggle.contains(target))) closeOptions();
  });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !options.hidden) {event.preventDefault(); event.stopPropagation(); closeOptions(true)}
  });
  panel.querySelector('[data-af-toggle="right"]')?.addEventListener('click', () => closeOptions());
  panel.querySelectorAll<HTMLButtonElement>('[data-af-prompt]').forEach(button => button.addEventListener('click', () => {
    prompt.value = (button.dataset.afPrompt || '').slice(0, prompt.maxLength);
    prompt.dispatchEvent(new Event('input', {bubbles:true}));
    prompt.focus();
    status.textContent = ready ? 'Draft ready. Review it before sending to OpenRouter.' : 'Draft ready. Connect your key in Assistant options before sending.';
    if(!ready){options.hidden=false;toggles.forEach(toggle=>toggle.setAttribute('aria-expanded','true'));keyInput.focus();}
  }));
  panel.querySelector('[data-af-new-chat]')?.addEventListener('click', () => {
    // Connected apps intercept this event to cancel active work before resetting.
    if (!panel.dispatchEvent(new CustomEvent('af:new-conversation', {bubbles:true, cancelable:true}))) return;
    generation++;stop();conversation=[];
    closeOptions();
    prompt.value = '';
    panel.querySelector('[data-af-messages]')?.replaceChildren();
    panel.querySelector<HTMLElement>('[data-af-welcome]')!.hidden = false;
    status.textContent = 'New conversation. No case files are attached.';
    sync();
    prompt.focus();
  });
  panel.querySelector('[data-af-composer]')?.addEventListener('submit', event => {
    event.preventDefault();
    void send();
  });
  prompt.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      void send();
    }
  });
}
