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


def _extra_domains(data_dir):
    path = os.path.join(data_dir or '', 'blocked_email_domains.txt')
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return {ln.strip().lower().lstrip('@') for ln in f if ln.strip() and not ln.lstrip().startswith('#')}
    except OSError:
        return set()


def is_disposable_email(email, data_dir=None):
    """True when the address belongs to a throw-away mailbox service (or one of its sub-domains)."""
    if not isinstance(email, str) or '@' not in email:
        return False
    domain = email.rsplit('@', 1)[1].strip().lower().rstrip('.')
    blocked = DISPOSABLE_DOMAINS | _extra_domains(data_dir)
    parts = domain.split('.')
    return any('.'.join(parts[i:]) in blocked for i in range(len(parts) - 1))
