import cv2
import os


def save_output(frame, output_path="output/result.jpg"):
    """Save the processed frame to a file."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    cv2.imwrite(output_path, frame)
    print(f"Result saved to: {output_path}")


def show_image(frame, title="Result"):
    """Display an image in a window."""
    cv2.imshow(title, frame)
    cv2.waitKey(0)
    cv2.destroyAllWindows()