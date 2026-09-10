const SUPABASE_URL = 'https://rrddmivicefrddmozwop.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_z__D6ZabHFzplMhI9vIb9w__h9isQE6';

const supabaseClient = window.supabase && SUPABASE_URL !== 'SUPABASE_URL' && SUPABASE_ANON_KEY !== 'SUPABASE_ANON_KEY'
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

async function signInWithGoogle() {
    if (!supabaseClient) {
        console.error('Supabase chưa được cấu hình. Hãy điền SUPABASE_URL và SUPABASE_ANON_KEY trong js/supabase-client.js.');
        return { data: null, error: new Error('Supabase chưa được cấu hình.') };
    }
    return supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href }
    });
}

async function signOut() {
    if (!supabaseClient) return { error: new Error('Supabase chưa được cấu hình.') };
    if (typeof window.saveCurrentWorkToCloud === 'function') {
        const saved = await window.saveCurrentWorkToCloud(true);
        if (!saved) {
            alert('Không thể lưu dữ liệu hiện tại lên cloud. Bạn vẫn đang đăng nhập để có thể thử lại.');
            return { error: new Error('Could not save current work before signing out.') };
        }
    }
    return supabaseClient.auth.signOut();
}

async function getCurrentUser() {
    if (!supabaseClient) return null;
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user || null;
}

async function saveMindmapToCloud(title, dataObject) {
    const user = await getCurrentUser();
    if (!supabaseClient || !user) return false;

    try {
        const table = supabaseClient.from('hodi database');
        const { data: existing, error: findError } = await table
            .select('id')
            .eq('user_id', user.id)
            .eq('title', title)
            .limit(1);
        if (findError) throw findError;

        const payload = { data: dataObject, updated_at: new Date().toISOString() };
        const { error } = existing && existing.length
            ? await table.update(payload).eq('id', existing[0].id)
            : await table.insert({ ...payload, user_id: user.id, title });
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('[VisualMind] Could not save to cloud:', error);
        return false;
    }
}

async function loadMindmapsFromCloud() {
    const user = await getCurrentUser();
    if (!supabaseClient || !user) return [];

    try {
        const { data, error } = await supabaseClient
            .from('hodi database')
            .select('id, title, data, updated_at')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('[VisualMind] Could not load from cloud:', error);
        return [];
    }
}

function showAuthModal() {
    if (document.getElementById('authModal')) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay auth-modal-overlay';
    overlay.id = 'authModal';
    overlay.innerHTML = `
        <div class="modal-box auth-modal-box" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
            <h3 id="authModalTitle">Đăng nhập để lưu</h3>
            <p>Hãy đăng nhập bằng Google để lưu nội dung của bạn.</p>
            <div class="modal-actions">
                <button class="btn-cancel" type="button" onclick="closeAuthModal()">Huỷ</button>
                <button class="btn-confirm" type="button" onclick="signInWithGoogle()">Đăng nhập Google</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeAuthModal();
    });
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) modal.remove();
}

async function requireAuthForSave(payload) {
    const user = await getCurrentUser();
    if (user) return true;
    sessionStorage.setItem('visualmind-pending-save', JSON.stringify(payload));
    showAuthModal();
    return false;
}

function consumePendingSave(handler) {
    const rawPayload = sessionStorage.getItem('visualmind-pending-save');
    if (!rawPayload || !supabaseClient) return;
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (!session) return;
        sessionStorage.removeItem('visualmind-pending-save');
        handler(JSON.parse(rawPayload));
    });
}

function updateAuthUI(user) {
    const button = document.querySelector('.home-login');
    if (!button) return;
    if (!user) {
        button.classList.remove('is-authenticated');
        button.innerHTML = '<span aria-hidden="true">♙</span><span>Đăng nhập</span>';
        button.onclick = signInWithGoogle;
        return;
    }
    const name = user.user_metadata?.full_name || user.email || 'Tài khoản';
    const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
    button.classList.add('is-authenticated');
    button.innerHTML = `${avatar ? `<img src="${avatar}" alt="">` : '<span aria-hidden="true">●</span>'}<span>${name}</span><span aria-hidden="true">⌄</span>`;
    button.onclick = () => button.classList.toggle('is-open');
    if (!button.querySelector('.auth-menu')) {
        const menu = document.createElement('span');
        menu.className = 'auth-menu';
        menu.innerHTML = '<button type="button" onclick="event.stopPropagation(); signOut()">Đăng xuất</button>';
        button.appendChild(menu);
    }
}

if (supabaseClient) {
    supabaseClient.auth.onAuthStateChange((_event, session) => {
        updateAuthUI(session?.user || null);
        if (session?.user) closeAuthModal();
    });
    getCurrentUser().then(updateAuthUI);
}
