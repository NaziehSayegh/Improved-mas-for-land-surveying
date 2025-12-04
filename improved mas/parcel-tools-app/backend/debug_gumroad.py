import urllib.request
import urllib.parse
import json
import ssl

def test_gumroad(key):
    print(f"Testing Gumroad Key: {key}")
    
    url = "https://api.gumroad.com/v2/licenses/verify"
    product_permalink = "uaupi"
    
    print(f"Using Permalink: {product_permalink}")
    
    data = urllib.parse.urlencode({
        'product_permalink': product_permalink,
        'license_key': key
    }).encode('utf-8')
    
    try:
        # Create a context that doesn't verify certificates (for debugging only)
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        req = urllib.request.Request(url, data=data, method='POST')
        
        with urllib.request.urlopen(req, context=ctx) as response:
            print(f"HTTP Status: {response.status}")
            body = response.read().decode('utf-8')
            print("Raw Response:")
            print(body)
            
            result = json.loads(body)
            print(f"\nSuccess: {result.get('success')}")
            
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code}")
        print(e.read().decode('utf-8'))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("Paste your Gumroad License Key below:")
    key = input().strip()
    test_gumroad(key)
