import os
import resend
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

resend.api_key = os.getenv("RESEND_API_KEY")

def get_invite_template(project_name, invite_link, inviter_email=None, project_icon=None):
    """
    Returns a branded HTML email template for project invitations with table-based layout and inlined styles.
    """
    
    # Forge Logo (Image + Text)
    logo_html = f"""
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
        <tr>
            <td align="center">
                <a href="https://forge.redmoon.red" style="text-decoration: none; border: none; display: inline-block;">
                    <table border="0" cellpadding="0" cellspacing="0">
                        <tr>
                            <td style="padding-right: 12px;">
                                <img src="https://firebasestorage.googleapis.com/v0/b/forgedev-ai.firebasestorage.app/o/web-app-manifest-512x512.png?alt=media&token=55102fad-7946-4934-b44d-0abc76196f6d" 
                                     style="width: 48px; height: 48px; border-radius: 12px; border: none; display: block;" 
                                     alt="F" />
                            </td>
                            <td>
                                <span style="color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-weight: 700; font-size: 24px; letter-spacing: -0.5px; text-decoration: none;">Forge AI</span>
                            </td>
                        </tr>
                    </table>
                </a>
            </td>
        </tr>
    </table>
    """
    
    inviter_text = f"<b>{inviter_email}</b> has invited you" if inviter_email else "You have been invited"
    
    # Project Icon Logic
    if project_icon and (project_icon.startswith("http") or project_icon.startswith("data:image")):
        proj_icon_html = f"""<img src="{project_icon}" style="width: 64px; height: 64px; border-radius: 16px; object-fit: cover; background-color: #333; display: block; margin: 0 auto 16px auto;" alt="Project Icon">"""
    else:
        # Fallback to initial
        initial = project_name[0].upper() if project_name else "?"
        proj_icon_html = f"""
        <div style="width: 64px; height: 64px; border-radius: 16px; background-color: #3f3f46; color: #ffffff; font-family: sans-serif; font-size: 32px; font-weight: bold; line-height: 64px; margin: 0 auto 16px auto; text-align: center;">
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
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #000000; color: #e4e4e7; margin: 0; padding: 20px; -webkit-font-smoothing: antialiased;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #000000;">
            <tr>
                <td align="center" style="padding: 20px 0;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #09090b; border: 1px solid #27272a; border-radius: 24px; overflow: hidden;">
                        <tr>
                            <td style="padding: 48px 40px; text-align: center;">
                                {logo_html}
                                
                                <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px; color: #ffffff; letter-spacing: -0.5px; margin-top: 0;">Join the Team</h1>
                                <p style="font-size: 15px; line-height: 24px; color: #a1a1aa; margin-bottom: 40px; margin-top: 0;">
                                    {inviter_text} to collaborate on a project.
                                </p>
                                
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #18181b; border: 1px solid #27272a; border-radius: 16px; margin-bottom: 40px;">
                                    <tr>
                                        <td align="center" style="padding: 32px;">
                                            {proj_icon_html}
                                            <div style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px; margin-top: 8px;">{project_name}</div>
                                        </td>
                                    </tr>
                                </table>

                                <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto 40px auto;">
                                    <tr>
                                        <td align="center" style="border-radius: 12px;" bgcolor="#ffffff">
                                            <a href="{invite_link}" target="_blank" style="font-size: 15px; font-family: sans-serif; color: #000000; text-decoration: none; border-radius: 12px; padding: 16px 40px; border: 1px solid #ffffff; display: inline-block; font-weight: 600;">
                                                View Invitation
                                            </a>
                                        </td>
                                    </tr>
                                </table>

                                <div style="margin-top: 32px; font-size: 13px; color: #52525b; word-break: break-all;">
                                    or copy this link: <br>
                                    <a href="{invite_link}" style="color: #71717a; text-decoration: none; font-size: 12px;">{invite_link}</a>
                                </div>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 32px; text-align: center; font-size: 13px; color: #52525b; background-color: #000000; border-top: 1px solid #27272a;">
                                &copy; 2026 Forge AI. All rights reserved.<br>
                                This invitation was sent to you because a team member added you to a project.
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
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
