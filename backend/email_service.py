import os
import resend
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

resend.api_key = os.getenv("RESEND_API_KEY")

def get_invite_template(project_name, invite_link, inviter_email=None, project_icon=None):
    """
    Returns a branded HTML email template for project invitations.
    """
    
    # Forge Logo (Image)
    logo_html = """
    <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 24px;">
        <img src="https://firebasestorage.googleapis.com/v0/b/forgedev-ai.firebasestorage.app/o/web-app-manifest-512x512.png?alt=media&token=55102fad-7946-4934-b44d-0abc76196f6d" style="width: 48px; height: 48px; border-radius: 12px; margin-right: 12px;" alt="Forge AI" />
        <span style="color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 700; font-size: 24px; letter-spacing: -0.5px;">Forge AI</span>
    </div>
    """
    
    inviter_text = f"<b>{inviter_email}</b> has invited you" if inviter_email else "You have been invited"
    
    # Project Icon Logic
    if project_icon and (project_icon.startswith("http") or project_icon.startswith("data:image")):
        # If it's a valid URL or Base64 (many email clients block base64, but some allow)
        # For data:image, we'll try, but fallback is text. 
        # Safest for emails is to host images, but we'll try to visually represent it.
        proj_icon_html = f"""<img src="{project_icon}" style="width: 64px; height: 64px; border-radius: 16px; object-fit: cover; margin-bottom: 16px; background-color: #333;" alt="Project Icon">"""
    else:
        # Fallback to initial
        initial = project_name[0].upper() if project_name else "?"
        proj_icon_html = f"""
        <div style="width: 64px; height: 64px; border-radius: 16px; background-color: #3f3f46; color: #fff; font-size: 32px; font-weight: bold; line-height: 64px; margin: 0 auto 16px auto;">
            {initial}
        </div>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project Invitation</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                background-color: #000000;
                color: #e4e4e7;
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }}
            .container {{
                max-width: 560px;
                margin: 40px auto;
                background-color: #09090b;
                border: 1px solid #27272a;
                border-radius: 24px;
                overflow: hidden;
            }}
            .content {{
                padding: 48px 40px;
                text-align: center;
            }}
            .h1 {{
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 16px;
                color: #ffffff;
                letter-spacing: -0.5px;
            }}
            .text {{
                font-size: 15px;
                line-height: 24px;
                color: #a1a1aa;
                margin-bottom: 40px;
            }}
            .project-card {{
                background-color: #18181b;
                border: 1px solid #27272a;
                border-radius: 16px;
                padding: 32px;
                margin-bottom: 40px;
                text-align: center;
            }}
            .project-name {{
                font-size: 20px;
                font-weight: 700;
                color: #ffffff;
                display: block;
                margin-top: 8px;
                letter-spacing: -0.5px;
            }}
            .btn {{
                background-color: #ffffff;
                color: #000000;
                font-weight: 600;
                font-size: 15px;
                padding: 16px 40px;
                border-radius: 12px;
                text-decoration: none;
                display: inline-block;
                transition: transform 0.1s;
            }}
            .footer {{
                padding: 32px;
                text-align: center;
                font-size: 13px;
                color: #52525b;
                background-color: #000000;
                border-top: 1px solid #27272a;
            }}
            .link-sub {{
                margin-top: 32px; 
                font-size: 13px; 
                color: #52525b;
                word-break: break-all;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="content">
                {logo_html}
                
                <div class="h1">Join the Team</div>
                <div class="text">
                    {inviter_text} to collaborate on a project.
                </div>
                
                <div class="project-card">
                    {proj_icon_html}
                    <span class="project-name">{project_name}</span>
                </div>

                <a href="{invite_link}" class="btn">View Invitation</a>

                <div class="link-sub">
                    or copy this link: <br>
                    <a href="{invite_link}" style="color: #71717a; text-decoration: none;">{invite_link}</a>
                </div>
            </div>
            <div class="footer">
                &copy; 2026 Forge AI. All rights reserved.<br>
                This invitation was sent to you because a team member added you to a project.
            </div>
        </div>
    </body>
    </html>
    """
    return html_content

def send_invite_email(to_email, project_name, invite_link, inviter_email=None, project_icon=None):
    """
    Sends an invite email via Resend.
    """
    try:
        if not resend.api_key:
            print("ERROR: RESEND_API_KEY is not set.")
            return False
            
        print(f"DEBUG: Sending email with API Key starting: {resend.api_key[:4]}...")

        html_content = get_invite_template(project_name, invite_link, inviter_email, project_icon)
        
        params = {
            "from": "Forge <forge@redmoon.red>", 
            "to": [to_email],
            "subject": f"Invitation to {project_name}",
            "html": html_content,
        }

        email = resend.Emails.send(params)
        print(f"DEBUG: Email sent result: {email}")
        return True
    except Exception as e:
        print(f"ERROR: Failed to send email via Resend: {e}")
        return False
