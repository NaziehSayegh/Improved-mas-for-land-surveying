"""Which email addresses may use the app: blocks throw-away / auto-generated mailbox services.

Email verification only proves the person can open *an* inbox; temp-mail services give anyone a working inbox
in seconds, so those domains are refused outright. Extra domains can be added (one per line) to
`blocked_email_domains.txt` in the app data folder without changing the code."""
import os

DISPOSABLE_DOMAINS = frozenset("""
mailinator.com mailinator.net mailinator2.com guerrillamail.com guerrillamail.net guerrillamail.org guerrillamail.biz
guerrillamail.de guerrillamailblock.com sharklasers.com grr.la spam4.me pokemail.net 10minutemail.com 10minutemail.net
10minutemail.org 10minemail.com 20minutemail.com 30minutemail.com minutemail.com tempmail.com temp-mail.org
temp-mail.io temp-mail.ru tempmail.net tempmail.dev tempmailo.com tempmail.plus tempr.email tempinbox.com tempail.com
temporary-mail.net temporarymail.com throwawaymail.com throwam.com yopmail.com yopmail.fr yopmail.net cool.fr.nf
jetable.fr.nf nospam.ze.tc nomail.xl.cx mega.zik.dj speed.1s.fr courriel.fr.nf moncourrier.fr.nf monemail.fr.nf
monmail.fr.nf trashmail.com trashmail.net trashmail.de trashmail.me trash-mail.com trashmail.io wegwerfmail.de
wegwerfmail.net wegwerfmail.org getnada.com nada.email nada.ltd maildrop.cc mailnesia.com mailcatch.com mailnull.com
mailsac.com mailtothis.com mintemail.com mohmal.com moakt.com moakt.cc moakt.ws tmpmail.org tmpmail.net tmpeml.com
tmails.net emailondeck.com emailfake.com email-fake.com fakeinbox.com fakemail.net fakemailgenerator.com
fake-mail.net dispostable.com discard.email discardmail.com discardmail.de spambox.us spamgourmet.com spamgourmet.net
spamex.com spamfree24.org spamhole.com spamavert.com spamspot.com burnermail.io burner.email anonbox.net
anonymbox.com anonaddy.me byom.de crazymailing.com deadaddress.com despam.it devnullmail.com dropmail.me
dayrep.com einrot.com fleckens.hu gustr.com harakirimail.com incognitomail.org inboxalias.com inboxbear.com
instant-mail.de jourrapide.com meltmail.com mytemp.email mytempemail.com mt2015.com mvrht.net my10minutemail.com
nowmymail.com objectmail.com onewaymail.com owlpic.com proxymail.eu rcpt.at reallymymail.com rhyta.com
safetymail.info sendspamhere.com smashmail.de snapmail.cc sneakemail.com sogetthis.com superrito.com teleworm.us
armyspy.com cuvox.de fakeinbox.info yomail.info zetmail.com mail-temp.com emailtemporanea.com emailtemporanea.net
luxusmail.org linshiyouxiang.net 1secmail.com 1secmail.org 1secmail.net kzccv.com qiott.com wuuvo.com icznn.com
vjuum.com laafd.com txcct.com ezztt.com dcctb.com yoggm.com mailpoof.com mail.tm mail.gw inboxkitten.com
tempsky.com tempmailaddress.com tempm.com tmpbox.net trbvm.com cetnob.com bareed.ws nwytg.net emltmp.com
guerrillamail.info clrmail.com fexbox.org fexpost.com mailbox.in.ua getairmail.com gettempmail.com dealrek.com
""".split())


_BUNDLED = None
_DATA_DIR_FOR_LIST = None
ONLINE_LIST_FILE = 'disposable_domains_online.txt'
ONLINE_LIST_URL = 'https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt'
_ONLINE_MAX_BYTES = 8 * 1024 * 1024
_ONLINE_MAX_AGE_DAYS = 7


def _read_domain_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return {ln.strip().lower() for ln in f if ln.strip() and not ln.startswith('#')}
    except OSError:
        return set()


def _bundled_domains():
    """The list shipped with the app plus (when present) the copy downloaded by the background refresh."""
    global _BUNDLED
    if _BUNDLED is None:
        here = os.path.dirname(os.path.abspath(__file__))
        domains = _read_domain_file(os.path.join(here, 'disposable_domains.txt'))
        if _DATA_DIR_FOR_LIST:
            domains |= _read_domain_file(os.path.join(_DATA_DIR_FOR_LIST, ONLINE_LIST_FILE))
        _BUNDLED = frozenset(domains)
    return _BUNDLED


def parse_online_list(text):
    """Domains from a downloaded list. Anything that is not a plain domain is ignored, and well-known providers
    are never accepted (so a bad or tampered list cannot lock out Gmail / Outlook users)."""
    import re
    ok = re.compile(r'^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')
    out = set()
    for ln in text.splitlines():
        d = ln.strip().lower()
        if d and not d.startswith('#') and len(d) <= 253 and ok.match(d) and d not in MAJOR_PROVIDERS:
            out.add(d)
    return out


def refresh_online_list(data_dir, url=ONLINE_LIST_URL, force=False, opener=None):
    """Download the community list into the data folder when the saved copy is older than a week.
    Never raises: any failure just leaves the shipped list in use. Returns the number of domains saved, or 0."""
    import time
    global _BUNDLED
    path = os.path.join(data_dir, ONLINE_LIST_FILE)
    try:
        if not force and os.path.exists(path) and time.time() - os.path.getmtime(path) < _ONLINE_MAX_AGE_DAYS * 86400:
            return 0
        if opener is None:
            import urllib.request
            opener = lambda u: urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'ParcelTools'}), timeout=30)  # noqa: E731
        with opener(url) as resp:
            raw = resp.read(_ONLINE_MAX_BYTES + 1)
        if len(raw) > _ONLINE_MAX_BYTES:
            return 0
        domains = parse_online_list(raw.decode('utf-8', errors='ignore'))
        if len(domains) < 5000:          # an error page or a truncated download must never replace a good list
            return 0
        os.makedirs(data_dir, exist_ok=True)
        tmp = path + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            f.write('\n'.join(sorted(domains)))
        os.replace(tmp, path)
        _BUNDLED = None                  # reload on next use
        return len(domains)
    except Exception as e:
        print(f'[EmailRules] List refresh skipped: {e}')
        return 0


def start_background_refresh(data_dir):
    """Load the saved list and refresh it in the background (called once when the backend starts)."""
    import threading
    global _DATA_DIR_FOR_LIST, _BUNDLED
    _DATA_DIR_FOR_LIST, _BUNDLED = data_dir, None
    threading.Thread(target=refresh_online_list, args=(data_dir,), daemon=True, name='email-list-refresh').start()


def _extra_domains(data_dir):
    path = os.path.join(data_dir or '', 'blocked_email_domains.txt')
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return {ln.strip().lower().lstrip('@') for ln in f if ln.strip() and not ln.lstrip().startswith('#')}
    except OSError:
        return set()


def _domain_of(email):
    if not isinstance(email, str) or '@' not in email:
        return ''
    return email.rsplit('@', 1)[1].strip().lower().rstrip('.')


def _domain_in(domain, blocked):
    parts = domain.split('.')
    return any('.'.join(parts[i:]) in blocked for i in range(len(parts) - 1))


# Well-known providers accepted in strict mode (admins can approve more, e.g. a company domain).
MAJOR_PROVIDERS = frozenset("""
gmail.com googlemail.com outlook.com hotmail.com live.com msn.com windowslive.com passport.com
hotmail.co.uk hotmail.fr hotmail.de hotmail.it hotmail.es outlook.sa outlook.fr outlook.de
yahoo.com yahoo.co.uk yahoo.fr yahoo.de yahoo.it yahoo.es yahoo.ca yahoo.com.au yahoo.co.in yahoo.co.jp ymail.com rocketmail.com
icloud.com me.com mac.com aol.com proton.me protonmail.com pm.me gmx.com gmx.net gmx.de web.de mail.com
zoho.com zohomail.com yandex.com yandex.ru mail.ru fastmail.com hey.com tutanota.com tuta.io
walla.co.il walla.com 012.net.il netvision.net.il bezeqint.net 013.net.il
""".split())


def is_disposable_email(email, data_dir=None, extra_blocked=()):
    """True when the address belongs to a throw-away mailbox service (or one of its sub-domains)."""
    domain = _domain_of(email)
    if not domain:
        return False
    blocked = DISPOSABLE_DOMAINS | _bundled_domains() | _extra_domains(data_dir) | set(extra_blocked)
    return _domain_in(domain, blocked)


class EmailPolicy:
    """Admin-managed rules shared by every install through Firestore (`app_config/email_policy`):
    {'blocked_domains': [...], 'allowed_domains': [...], 'strict': bool}. Cached, and kept on disk for offline use."""
    CACHE_SECONDS = 300

    def __init__(self, firebase_service, data_dir):
        import json  # noqa: F401  (used by the helpers below)
        self.fs = firebase_service
        self.data_dir = data_dir
        self.path = os.path.join(data_dir, 'email_policy.json')
        self._cache = None
        self._cache_time = 0.0

    def _read_disk(self):
        import json
        try:
            with open(self.path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (OSError, ValueError):
            return {}

    def _write_disk(self, policy):
        import json
        try:
            os.makedirs(self.data_dir, exist_ok=True)
            with open(self.path, 'w', encoding='utf-8') as f:
                json.dump(policy, f)
        except OSError:
            pass

    def get(self):
        import time
        now = time.time()
        if self._cache is not None and now - self._cache_time < self.CACHE_SECONDS:
            return self._cache
        policy = None
        try:
            if self.fs._is_online():
                doc = self.fs.db.collection('app_config').document('email_policy').get()
                policy = doc.to_dict() if doc.exists else {}
                self._write_disk(policy)
        except Exception as e:
            print(f'[EmailPolicy] Could not read the email rules: {e}')
            policy = None
        if policy is None:
            policy = self._read_disk()
        self._cache, self._cache_time = policy or {}, now
        return self._cache

    @staticmethod
    def _clean(domains):
        out = []
        for d in domains or []:
            d = str(d).strip().lower().lstrip('@')
            if d and '.' in d and ' ' not in d and d not in out:
                out.append(d)
        return out

    def set(self, strict, blocked_domains, allowed_domains):
        import time
        policy = {'strict': bool(strict), 'blocked_domains': self._clean(blocked_domains),
                  'allowed_domains': self._clean(allowed_domains), 'updated_at': time.strftime('%Y-%m-%dT%H:%M:%S')}
        if self.fs._is_online():
            self.fs.db.collection('app_config').document('email_policy').set(policy)
        self._write_disk(policy)
        self._cache, self._cache_time = policy, time.time()
        return policy

    def check(self, email):
        """None when the address may be used, otherwise (code, message)."""
        domain = _domain_of(email)
        if not domain:
            return None
        p = self.get()
        if is_disposable_email(email, self.data_dir, p.get('blocked_domains') or ()):
            return ('EMAIL_NOT_ALLOWED', 'Temporary / disposable email addresses are not allowed. Please use your real email address.')
        if p.get('strict') and not _domain_in(domain, set(MAJOR_PROVIDERS) | set(p.get('allowed_domains') or ())):
            return ('EMAIL_DOMAIN_NOT_APPROVED', 'Please sign up with a personal email from a well-known provider (Gmail, Outlook, Yahoo, iCloud...). '
                                                  'Using a company address? Contact support to have your domain approved.')
        return None
